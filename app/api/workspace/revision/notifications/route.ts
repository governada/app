/**
 * Revision Notifications API
 *
 * GET:   Fetch unread revision notifications for the current user
 * PATCH: Mark a notification as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { RevisionNotification } from '@/lib/workspace/revision/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MarkReadSchema = z.object({
  notificationId: z.string().min(1, 'notificationId is required'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToNotification(row: Record<string, unknown>): RevisionNotification {
  return {
    id: row.id as string,
    proposalId: (row.draft_id as string) ?? (row.proposal_tx_hash as string) ?? '',
    versionNumber: row.version_number as number,
    recipientUserId: row.recipient_user_id as string,
    recipientType: row.recipient_type as RevisionNotification['recipientType'],
    sectionsChanged: (row.sections_changed as string[]) ?? [],
    themesAddressed: (row.themes_addressed as string[]) ?? [],
    readAt: (row.read_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// GET — fetch unread revision notifications for current user
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Fetch unread notifications (read_at IS NULL), most recent first
    const { data, error } = await admin
      .from('proposal_revision_notifications')
      .select('*')
      .eq('recipient_user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const notifications = (data ?? []).map((row) =>
      rowToNotification(row as unknown as Record<string, unknown>),
    );

    return NextResponse.json({
      notifications,
      unreadCount: notifications.length,
    });
  },
  { auth: 'required' },
);

// ---------------------------------------------------------------------------
// PATCH — mark a notification as read
// ---------------------------------------------------------------------------

export const PATCH = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const userId = ctx.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = MarkReadSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Mark the notification as read — only if it belongs to the current user
    const { data, error } = await admin
      .from('proposal_revision_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', body.notificationId)
      .eq('recipient_user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Notification not found or not owned' }, { status: 404 });
    }

    return NextResponse.json({
      notification: rowToNotification(data as unknown as Record<string, unknown>),
    });
  },
  { auth: 'required', rateLimit: { max: 60, window: 60 } },
);
