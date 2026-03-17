/**
 * Revision Management API
 *
 * POST: Submit a revision with change justifications + notify reviewers
 * GET:  Fetch revision state for a draft (latest version, changed sections, justifications)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { computeChangedSections } from '@/lib/workspace/revision/justifications';
import { notifyReviewers } from '@/lib/workspace/revision/notifications';
import type { DraftContent } from '@/lib/workspace/types';
import type {
  ChangeJustification,
  ChangedSection,
  RevisionState,
} from '@/lib/workspace/revision/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ChangeJustificationSchema = z.object({
  field: z.enum(['title', 'abstract', 'motivation', 'rationale']),
  justification: z.string().max(2000),
  linkedThemeId: z.string().optional(),
});

const SubmitRevisionSchema = z.object({
  draftId: z.string().min(1, 'draftId is required'),
  versionName: z.string().min(1, 'versionName is required').max(200),
  editSummary: z.string().max(1000).optional(),
  changeJustifications: z.array(ChangeJustificationSchema).max(10).default([]),
});

// ---------------------------------------------------------------------------
// POST — submit revision with justifications
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = SubmitRevisionSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Fetch current draft
    const { data: draft, error: draftError } = await admin
      .from('proposal_drafts')
      .select('*')
      .eq('id', body.draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify ownership — only the draft owner can submit revisions
    const { data: user } = await admin
      .from('users')
      .select('stake_address')
      .eq('id', userId)
      .maybeSingle();

    if (!user?.stake_address || user.stake_address !== draft.owner_stake_address) {
      return NextResponse.json(
        { error: 'Only the proposal owner can submit revisions' },
        { status: 403 },
      );
    }

    // Get the latest version number
    const { data: latestVersion } = await admin
      .from('proposal_draft_versions')
      .select('version_number')
      .eq('draft_id', body.draftId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    // Build the content snapshot from the current draft state
    const newContent: DraftContent = {
      title: draft.title ?? '',
      abstract: draft.abstract ?? '',
      motivation: draft.motivation ?? '',
      rationale: draft.rationale ?? '',
      proposalType: draft.proposal_type,
      typeSpecific: draft.type_specific ?? undefined,
    };

    // Insert the new version with change justifications
    const { data: version, error: versionError } = await admin
      .from('proposal_draft_versions')
      .insert({
        draft_id: body.draftId,
        version_number: nextVersionNumber,
        version_name: body.versionName,
        edit_summary: body.editSummary ?? null,
        content: newContent as unknown as Record<string, unknown>,
        change_justifications:
          body.changeJustifications.length > 0
            ? (body.changeJustifications as unknown as Record<string, unknown>[])
            : null,
      })
      .select()
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Failed to save revision' }, { status: 500 });
    }

    // Update draft current_version
    await admin
      .from('proposal_drafts')
      .update({
        current_version: nextVersionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.draftId);

    // Compute changed fields for notification
    const changedFields = body.changeJustifications.map((j: ChangeJustification) => j.field);
    const addressedThemes = body.changeJustifications
      .filter((j: ChangeJustification) => j.linkedThemeId)
      .map((j: ChangeJustification) => j.linkedThemeId!);

    // Send reviewer notifications (fire and forget — don't block the response)
    notifyReviewers(
      draft.id,
      body.draftId,
      nextVersionNumber,
      changedFields,
      addressedThemes,
    ).catch(() => {
      // Notification failures are non-critical
    });

    captureServerEvent('revision_submitted', {
      draft_id: body.draftId,
      version_number: nextVersionNumber,
      justification_count: body.changeJustifications.length,
      changed_fields: changedFields,
      addressed_themes: addressedThemes.length,
    });

    return NextResponse.json(
      {
        version: {
          id: version.id,
          draftId: version.draft_id,
          versionNumber: version.version_number,
          versionName: version.version_name ?? '',
          editSummary: version.edit_summary ?? null,
          content: version.content,
          changeJustifications: version.change_justifications ?? [],
          createdAt: version.created_at,
        },
      },
      { status: 201 },
    );
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);

// ---------------------------------------------------------------------------
// GET — fetch revision state for a draft
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const { searchParams } = request.nextUrl;
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId parameter' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch the two most recent versions for comparison
    const { data: versions, error: versionsError } = await admin
      .from('proposal_draft_versions')
      .select('*')
      .eq('draft_id', draftId)
      .order('version_number', { ascending: false })
      .limit(2);

    if (versionsError || !versions || versions.length === 0) {
      return NextResponse.json({ error: 'No versions found' }, { status: 404 });
    }

    const latest = versions[0];
    const previous = versions.length > 1 ? versions[1] : null;

    // Compute changed sections if we have a previous version
    let changedSections: ChangedSection[] = [];
    if (previous) {
      const oldContent = previous.content as unknown as DraftContent;
      const newContent = latest.content as unknown as DraftContent;
      changedSections = computeChangedSections(oldContent, newContent);
    }

    // Parse justifications from the latest version
    const justifications: ChangeJustification[] = Array.isArray(latest.change_justifications)
      ? (latest.change_justifications as unknown as ChangeJustification[])
      : [];

    // Check for unread notifications for the current user on this revision
    let hasUnreadNotifications = false;
    if (ctx.userId) {
      const { count } = await admin
        .from('proposal_revision_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('draft_id', draftId)
        .eq('version_number', latest.version_number)
        .eq('recipient_user_id', ctx.userId)
        .is('read_at', null);

      hasUnreadNotifications = (count ?? 0) > 0;
    }

    const state: RevisionState = {
      latestVersion: {
        id: latest.id,
        versionNumber: latest.version_number,
        versionName: latest.version_name ?? '',
        editSummary: latest.edit_summary ?? null,
        createdAt: latest.created_at,
      },
      previousVersion: previous
        ? {
            id: previous.id,
            versionNumber: previous.version_number,
            versionName: previous.version_name ?? '',
            createdAt: previous.created_at,
          }
        : null,
      changedSections,
      justifications,
      hasUnreadNotifications,
    };

    return NextResponse.json({ state });
  },
  { auth: 'optional' },
);
