'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useAgent } from '@/hooks/useAgent';
import { useAmbientConstitutionalCheck } from '@/hooks/useAmbientConstitutionalCheck';
import { useDraft, useUpdateDraft } from '@/hooks/useDrafts';
import { useFeedbackThemes } from '@/hooks/useFeedbackThemes';
import { useProactiveAnalysis } from '@/hooks/useProactiveAnalysis';
import { useSectionAnalysis } from '@/hooks/useSectionAnalysis';
import { useSuggestionAnnotations } from '@/hooks/useSuggestionAnnotations';
import { useSyncEntityToURL } from '@/hooks/useSyncEntityToURL';
import { useTeam } from '@/hooks/useTeam';
import { useRegisterEditorCommands } from '@/hooks/useRegisterEditorCommands';
import { posthog } from '@/lib/posthog';
import { useSaveStatus } from '@/lib/workspace/save-status';
import { acceptDiff, rejectDiff } from '@/components/workspace/editor/AIDiffMark';
import {
  buildEditorContext,
  injectInlineComment,
  SLASH_COMMAND_PROMPTS,
} from '@/components/studio/studioEditorHelpers';
import { computeChangedFields } from '@/components/workspace/editor/ChangeSinceBadge';
import { injectProposedEdit } from '@/components/workspace/editor/ProposalEditor';
import type { Editor } from '@tiptap/core';
import type {
  EditorMode,
  MarginIndicator,
  ProposalField,
  ProposedComment,
  ProposedEdit,
  SlashCommandType,
} from '@/lib/workspace/editor/types';
import { PROPOSAL_TYPE_LABELS, type DraftVersion, type ProposalDraft, type ProposalType, type TeamRole } from '@/lib/workspace/types';

export interface WorkspaceEditorPermissions {
  isOwner: boolean;
  canEdit: boolean;
  readOnly: boolean;
  stageReadOnly: boolean;
  userRole: 'proposer' | 'cc_member' | 'reviewer';
}

export interface WorkspaceEditorReadinessBadge {
  level: 'low' | 'moderate' | 'strong';
  blockerCount: number;
}

export function deriveWorkspaceEditorPermissions({
  stakeAddress,
  ownerStakeAddress,
  teamRole,
  draftStatus,
  segment,
}: {
  stakeAddress: string | null;
  ownerStakeAddress: string | null | undefined;
  teamRole: TeamRole | null;
  draftStatus: ProposalDraft['status'] | null | undefined;
  segment: string;
}): WorkspaceEditorPermissions {
  const isOwner = !!stakeAddress && ownerStakeAddress === stakeAddress;
  const canEdit = isOwner || teamRole === 'lead' || teamRole === 'editor';
  const stageReadOnly =
    draftStatus === 'final_comment' ||
    draftStatus === 'submitted' ||
    draftStatus === 'community_review';
  const readOnly = stageReadOnly || !canEdit;
  const userRole = isOwner ? 'proposer' : segment === 'cc' ? 'cc_member' : 'reviewer';

  return { isOwner, canEdit, readOnly, stageReadOnly, userRole };
}

export function deriveWorkspaceEditorReadinessBadge(
  draft:
    | Pick<
        ProposalDraft,
        'title' | 'abstract' | 'motivation' | 'rationale' | 'lastConstitutionalCheck'
      >
    | null
    | undefined,
  canEdit: boolean,
): WorkspaceEditorReadinessBadge | undefined {
  if (!draft || !canEdit) return undefined;

  const fields = [draft.title, draft.abstract, draft.motivation, draft.rationale];
  const filled = fields.filter((field) => field && field.trim().length > 0).length;
  const constCheck = draft.lastConstitutionalCheck?.score ?? null;

  let blockerCount = 0;
  if (filled < 4) blockerCount++;
  if (constCheck === 'fail') blockerCount++;

  const level =
    blockerCount > 0
      ? 'low'
      : constCheck === 'pass' && filled >= 4
        ? 'strong'
        : 'moderate';

  return { level, blockerCount };
}

function deriveTypeSpecificState(draft: ProposalDraft | null): Record<string, unknown> {
  return (draft?.typeSpecific as Record<string, unknown>) ?? {};
}

function deriveMarginIndicators(
  constitutionalResult: ReturnType<typeof useAmbientConstitutionalCheck>['result'],
): MarginIndicator[] {
  if (!constitutionalResult?.flags?.length) return [];

  const sectionFlags: Record<number, MarginIndicator['constitutionalRisk']> = {};
  for (const flag of constitutionalResult.flags) {
    const concern = flag.concern.toLowerCase();
    let idx = -1;
    if (concern.includes('abstract') || concern.includes('summary')) idx = 1;
    else if (concern.includes('motivation') || concern.includes('purpose')) idx = 2;
    else if (concern.includes('rationale') || concern.includes('justification')) idx = 3;
    else idx = 2;

    const severity =
      flag.severity === 'critical' ? 'red' : flag.severity === 'warning' ? 'amber' : 'green';
    const current = sectionFlags[idx];
    if (!current || severity === 'red' || (severity === 'amber' && current !== 'red')) {
      sectionFlags[idx] = severity;
    }
  }

  return Object.entries(sectionFlags).map(([idx, risk]) => ({
    paragraphIndex: Number(idx),
    constitutionalRisk: risk,
  }));
}

function deriveUserRole(
  isOwner: boolean,
  segment: string,
): 'proposer' | 'cc_member' | 'reviewer' {
  if (isOwner) return 'proposer';
  return segment === 'cc' ? 'cc_member' : 'reviewer';
}

export interface WorkspaceEditorController {
  draftId: string | null;
  draft: ProposalDraft | null;
  error: unknown;
  isLoading: boolean;
  versions: DraftVersion[] | null;
  permissions: WorkspaceEditorPermissions;
  readinessBadge?: WorkspaceEditorReadinessBadge;
  showJustificationFlow: boolean;
  setShowJustificationFlow: (value: boolean) => void;
  mode: EditorMode;
  setMode: (next: EditorMode) => void;
  scaffoldDismissed: boolean;
  setScaffoldDismissed: (value: boolean) => void;
  showScaffold: boolean;
  typeSpecific: Record<string, unknown>;
  handleTypeSpecificChange: (next: Record<string, unknown>) => void;
  handleTypeSpecificBlur: () => void;
  feedbackThemes: ReturnType<typeof useFeedbackThemes>['themes'];
  constitutionalResult: ReturnType<typeof useAmbientConstitutionalCheck>['result'];
  constitutionalLoading: boolean;
  sectionResults: ReturnType<typeof useSectionAnalysis>['results'];
  sectionLoading: ReturnType<typeof useSectionAnalysis>['loading'];
  activeSuggestions: ReturnType<typeof useSuggestionAnnotations>['suggestions'];
  allSuggestions: ReturnType<typeof useSuggestionAnnotations>['allSuggestions'];
  suggestionMappings: {
    editId: string;
    annotationId: string;
    suggestion: ReturnType<typeof useSuggestionAnnotations>['suggestions'][number];
  }[];
  resolvedCount: number;
  showVersionDiff: boolean;
  versionDiffVersion: number | null;
  changedFields: ReturnType<typeof computeChangedFields>;
  handleShowChanges: (reviewedAtVersion: number, show: boolean) => void;
  content: { title: string; abstract: string; motivation: string; rationale: string };
  proactiveFlag: boolean | null;
  proactiveAnalysis: ReturnType<typeof useProactiveAnalysis>;
  marginIndicators: MarginIndicator[];
  draftStatus: ProposalDraft['status'] | undefined;
  typeLabel: string;
  teamRole: TeamRole | null;
  stakeAddress: string | null;
  agentMessages: ReturnType<typeof useAgent>['messages'];
  agentIsStreaming: boolean;
  agentActiveToolCall: ReturnType<typeof useAgent>['activeToolCall'];
  agentError: ReturnType<typeof useAgent>['error'];
  currentUserId: string;
  handleContentChange: (field: ProposalField, value: string) => void;
  handleSaveRetry: () => void;
  handleEditorReady: (editor: Editor) => void;
  handleSlashCommand: (command: SlashCommandType, sectionContext: string) => void;
  handleCommand: (instruction: string, selectedText: string, section: string) => void;
  handleChatSendMessage: (message: string) => Promise<void>;
  handleApplyEdit: (edit: ProposedEdit) => void;
  handleApplyComment: (comment: ProposedComment) => void;
  handleInsightApply: (field: string, suggestion: string) => void;
  handleDiffAccept: (editId: string) => void;
  handleDiffReject: (editId: string) => void;
  handleSuggestionAccept: (annotationId: string, editId: string) => void;
  handleSuggestionReject: (annotationId: string, editId: string) => void;
  handleSuggestionAcceptAll: () => void;
  handleSuggestionRejectAll: () => void;
  isResponseRevision: boolean;
}

export function useWorkspaceEditorController(): WorkspaceEditorController {
  const params = useParams();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;

  useSyncEntityToURL();
  const { data, isLoading, error } = useDraft(draftId);
  const draft = data?.draft ?? null;
  const versions = data?.versions ?? null;

  const [showJustificationFlow, setShowJustificationFlow] = useState(false);
  const [mode, setModeRaw] = useState<EditorMode>('edit');
  const editorRef = useRef<Editor | null>(null);

  const { stakeAddress, segment } = useSegment();
  const { data: teamData } = useTeam(draftId);
  const teamRole: TeamRole | null = (() => {
    if (!stakeAddress || !teamData?.members) return null;
    const member = teamData.members.find((entry) => entry.stakeAddress === stakeAddress);
    return member?.role ?? null;
  })();

  const permissions = useMemo(
    () =>
      deriveWorkspaceEditorPermissions({
        stakeAddress,
        ownerStakeAddress: draft?.ownerStakeAddress,
        teamRole,
        draftStatus: draft?.status,
        segment,
      }),
    [draft?.ownerStakeAddress, draft?.status, segment, stakeAddress, teamRole],
  );

  const updateDraft = useUpdateDraft(draftId ?? '');
  const { setSaving } = useSaveStatus();

  const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typeSpecificDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(contentDebounceRef.current);
      clearTimeout(typeSpecificDebounceRef.current);
    },
    [],
  );

  const setMode = useCallback(
    (next: EditorMode) => {
      posthog.capture('workspace_mode_changed', { proposal_id: draftId, mode: next });
      setModeRaw(next);
    },
    [draftId],
  );

  const [scaffoldDismissed, setScaffoldDismissed] = useState(false);
  const aiDraftEnabled = useFeatureFlag('author_ai_draft');
  const isDraftEmpty = !draft?.title && !draft?.abstract && !draft?.motivation && !draft?.rationale;
  const showScaffold =
    isDraftEmpty &&
    aiDraftEnabled === true &&
    !scaffoldDismissed &&
    draft?.status === 'draft' &&
    permissions.canEdit;

  const [typeSpecific, setTypeSpecific] = useState<Record<string, unknown>>({});
  useEffect(() => {
    setTypeSpecific(deriveTypeSpecificState(draft));
  }, [draft?.typeSpecific]);

  const lifecycleStatus = draft?.status;
  useEffect(() => {
    if (!lifecycleStatus) return;
    if (lifecycleStatus === 'draft' && permissions.canEdit) {
      setModeRaw('edit');
    } else if (lifecycleStatus === 'response_revision' && permissions.canEdit) {
      setModeRaw('edit');
    } else {
      setModeRaw('review');
    }
  }, [lifecycleStatus, permissions.canEdit]);

  const userRole = deriveUserRole(permissions.isOwner, segment);
  const {
    sendMessage: agentSendMessage,
    messages: agentMessages,
    isStreaming: agentIsStreaming,
    lastEdit: agentLastEdit,
    lastComment: agentLastComment,
    clearLastEdit: agentClearLastEdit,
    clearLastComment: agentClearLastComment,
    activeToolCall: agentActiveToolCall,
    error: agentError,
  } = useAgent({ proposalId: draftId ?? '', userRole });

  const readinessBadge = useMemo(
    () => deriveWorkspaceEditorReadinessBadge(draft, permissions.canEdit),
    [draft, permissions.canEdit],
  );

  const submittedTxHash = draft?.submittedTxHash ?? null;
  const { themes: feedbackThemes } = useFeedbackThemes(submittedTxHash, submittedTxHash ? 0 : null);

  const { result: constitutionalResult, isLoading: constitutionalLoading } =
    useAmbientConstitutionalCheck(draft);
  const {
    results: sectionResults,
    loading: sectionLoading,
    analyzeSection,
  } = useSectionAnalysis(draft);

  const prevContentHashRef = useRef<string>('');
  useEffect(() => {
    if (!draft || permissions.readOnly) return;
    const sig = `${draft.abstract?.slice(0, 50)}|${draft.abstract?.length}|${draft.motivation?.slice(0, 50)}|${draft.motivation?.length}|${draft.rationale?.slice(0, 50)}|${draft.rationale?.length}`;
    if (sig === prevContentHashRef.current) return;
    prevContentHashRef.current = sig;
    if (draft.abstract && draft.abstract.length >= 20) analyzeSection('abstract');
    if (draft.motivation && draft.motivation.length >= 20) analyzeSection('motivation');
    if (draft.rationale && draft.rationale.length >= 20) analyzeSection('rationale');
  }, [analyzeSection, draft, permissions.readOnly]);

  const isResponseRevision = draft?.status === 'response_revision' && permissions.isOwner;
  const {
    suggestions: activeSuggestions,
    allSuggestions,
    acceptSuggestion,
    rejectSuggestion,
  } = useSuggestionAnnotations(draft?.submittedTxHash ?? null, draft?.submittedTxHash ? 0 : null);
  const suggestionMapRef = useRef<Map<string, string>>(new Map());
  const [injectedSuggestionIds, setInjectedSuggestionIds] = useState<Set<string>>(new Set());
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (!isResponseRevision || !editorReady || !editorRef.current || activeSuggestions.length === 0)
      return;

    const newlyInjected: string[] = [];
    for (const suggestion of activeSuggestions) {
      if (injectedSuggestionIds.has(suggestion.id)) continue;

      const editId = `review-sug-${suggestion.id}`;
      const edit = {
        field: suggestion.anchorField as ProposalField,
        anchorStart: suggestion.anchorStart,
        anchorEnd: suggestion.anchorEnd,
        originalText: suggestion.suggestedText.original,
        proposedText: suggestion.suggestedText.proposed,
        explanation: suggestion.suggestedText.explanation,
      };

      injectProposedEdit(editorRef.current, edit, editId);
      suggestionMapRef.current.set(editId, suggestion.id);
      newlyInjected.push(suggestion.id);
    }

    if (newlyInjected.length > 0) {
      setInjectedSuggestionIds((prev) => {
        const next = new Set(prev);
        for (const id of newlyInjected) next.add(id);
        return next;
      });
    }
  }, [activeSuggestions, editorReady, injectedSuggestionIds, isResponseRevision]);

  const suggestionMappings = useMemo(
    () =>
      activeSuggestions
        .filter((suggestion) => injectedSuggestionIds.has(suggestion.id))
        .map((suggestion) => ({
          editId: `review-sug-${suggestion.id}`,
          annotationId: suggestion.id,
          suggestion,
        })),
    [activeSuggestions, injectedSuggestionIds],
  );

  const resolvedCount = useMemo(
    () => allSuggestions.filter((suggestion) => suggestion.status !== 'active').length,
    [allSuggestions],
  );

  const handleSuggestionAccept = useCallback(
    (annotationId: string, editId: string) => {
      if (editorRef.current) {
        acceptDiff(editorRef.current, editId);
      }
      acceptSuggestion(annotationId);
      suggestionMapRef.current.delete(editId);
    },
    [acceptSuggestion],
  );

  const handleSuggestionReject = useCallback(
    (annotationId: string, editId: string) => {
      if (editorRef.current) {
        rejectDiff(editorRef.current, editId);
      }
      rejectSuggestion(annotationId);
      suggestionMapRef.current.delete(editId);
    },
    [rejectSuggestion],
  );

  const handleDiffAccept = useCallback(
    (editId: string) => {
      if (!editorRef.current) return;
      acceptDiff(editorRef.current, editId);
      posthog.capture('workspace_inline_edit_accepted', {
        proposal_id: draftId,
        edit_id: editId,
      });

      const annotationId = suggestionMapRef.current.get(editId);
      if (annotationId) {
        acceptSuggestion(annotationId);
        suggestionMapRef.current.delete(editId);
      }
    },
    [acceptSuggestion, draftId],
  );

  const handleDiffReject = useCallback(
    (editId: string) => {
      if (!editorRef.current) return;
      rejectDiff(editorRef.current, editId);
      posthog.capture('workspace_inline_edit_rejected', {
        proposal_id: draftId,
        edit_id: editId,
      });

      const annotationId = suggestionMapRef.current.get(editId);
      if (annotationId) {
        rejectSuggestion(annotationId);
        suggestionMapRef.current.delete(editId);
      }
    },
    [draftId, rejectSuggestion],
  );

  const handleSuggestionAcceptAll = useCallback(() => {
    for (const mapping of suggestionMappings) {
      handleSuggestionAccept(mapping.annotationId, mapping.editId);
    }
  }, [handleSuggestionAccept, suggestionMappings]);

  const handleSuggestionRejectAll = useCallback(() => {
    for (const mapping of suggestionMappings) {
      handleSuggestionReject(mapping.annotationId, mapping.editId);
    }
  }, [handleSuggestionReject, suggestionMappings]);

  useRegisterEditorCommands({
    onSaveVersion: permissions.canEdit && !permissions.readOnly ? () => setShowJustificationFlow(true) : undefined,
    onDiffMode: permissions.canEdit ? () => setMode(mode === 'diff' ? 'edit' : 'diff') : undefined,
    onRespondToReview: isResponseRevision ? () => setMode('edit') : undefined,
  });

  const [showVersionDiff, setShowVersionDiff] = useState(false);
  const [versionDiffVersion, setVersionDiffVersion] = useState<number | null>(null);
  const { data: versionContentData } = useQuery<{
    version: {
      content: {
        title?: string;
        abstract?: string;
        motivation?: string;
        rationale?: string;
      };
    };
  }>({
    queryKey: ['draft-version-content', draftId, versionDiffVersion],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      try {
        const { getStoredSession } = await import('@/lib/supabaseAuth');
        const token = getStoredSession();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {
        /* no session */
      }

      const res = await fetch(
        `/api/workspace/drafts/${encodeURIComponent(draftId!)}/version?versionNumber=${versionDiffVersion}`,
        { headers },
      );
      if (!res.ok) throw new Error('Version not found');
      return res.json();
    },
    enabled: !!draftId && !!versionDiffVersion && showVersionDiff,
    staleTime: 300_000,
  });

  const handleShowChanges = useCallback((reviewedAtVersion: number, show: boolean) => {
    setShowVersionDiff(show);
    setVersionDiffVersion(show ? reviewedAtVersion : null);
  }, []);

  const changedFields = useMemo(() => {
    if (!showVersionDiff || !versionContentData?.version?.content) return [];
    return computeChangedFields(versionContentData.version.content, {
      title: draft?.title ?? '',
      abstract: draft?.abstract ?? '',
      motivation: draft?.motivation ?? '',
      rationale: draft?.rationale ?? '',
    });
  }, [
    draft?.abstract,
    draft?.motivation,
    draft?.rationale,
    draft?.title,
    showVersionDiff,
    versionContentData,
  ]);

  const content = useMemo(
    () => ({
      title: draft?.title ?? '',
      abstract: draft?.abstract ?? '',
      motivation: draft?.motivation ?? '',
      rationale: draft?.rationale ?? '',
    }),
    [draft?.abstract, draft?.motivation, draft?.rationale, draft?.title],
  );

  const proactiveFlag = useFeatureFlag('proactive_interventions');
  const proactiveAnalysis = useProactiveAnalysis({
    proposalContent: content,
    proposalType: draft?.proposalType ?? 'InfoAction',
    constitutionalScore: constitutionalResult?.score,
    enabled: !!proactiveFlag && permissions.canEdit && !permissions.readOnly,
  });

  const marginIndicators = useMemo(
    () => deriveMarginIndicators(constitutionalResult),
    [constitutionalResult],
  );

  const handleContentChange = useCallback(
    (field: ProposalField, value: string) => {
      setSaving();
      clearTimeout(contentDebounceRef.current);
      contentDebounceRef.current = setTimeout(() => {
        updateDraft.mutate({ [field]: value });
      }, 500);
    },
    [setSaving, updateDraft],
  );

  const handleTypeSpecificChange = useCallback(
    (next: Record<string, unknown>) => {
      setTypeSpecific(next);
      setSaving();
      clearTimeout(typeSpecificDebounceRef.current);
      typeSpecificDebounceRef.current = setTimeout(() => {
        updateDraft.mutate({ typeSpecific: next });
      }, 500);
    },
    [setSaving, updateDraft],
  );

  const handleTypeSpecificBlur = useCallback(() => {
    clearTimeout(typeSpecificDebounceRef.current);
    setSaving();
    updateDraft.mutate({ typeSpecific });
  }, [setSaving, typeSpecific, updateDraft]);

  const handleSaveRetry = useCallback(() => {
    if (!draft) return;
    setSaving();
    updateDraft.mutate({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
    });
  }, [draft, setSaving, updateDraft]);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
    setEditorReady(true);
  }, []);

  useEffect(() => {
    if (!agentLastEdit || !editorRef.current) return;
    injectProposedEdit(editorRef.current, agentLastEdit);
    agentClearLastEdit();
  }, [agentClearLastEdit, agentLastEdit]);

  useEffect(() => {
    if (!agentLastComment || !editorRef.current) return;
    injectInlineComment(editorRef.current, agentLastComment);
    agentClearLastComment();
  }, [agentClearLastComment, agentLastComment]);

  const handleSlashCommand = useCallback(
    (command: SlashCommandType, sectionContext: string) => {
      const prompt = SLASH_COMMAND_PROMPTS[command]?.(sectionContext);
      if (!prompt) return;
      const ctx = buildEditorContext(editorRef.current, content, mode);
      agentSendMessage(prompt, ctx);
    },
    [agentSendMessage, content, mode],
  );

  const handleCommand = useCallback(
    (instruction: string, selectedText: string, section: string) => {
      let prompt = instruction;
      if (selectedText) {
        prompt = `Regarding the selected text in the ${section} section: "${selectedText}"\n\nInstruction: ${instruction}`;
      }
      const ctx = buildEditorContext(editorRef.current, content, mode);
      agentSendMessage(prompt, ctx);
    },
    [agentSendMessage, content, mode],
  );

  const handleChatSendMessage = useCallback(
    async (message: string) => {
      const ctx = buildEditorContext(editorRef.current, content, mode);
      posthog.capture('workspace_agent_message_sent', {
        proposal_id: draftId,
        mode,
        user_role: userRole,
        has_selection: !!ctx.selectedText,
      });
      await agentSendMessage(message, ctx);
    },
    [agentSendMessage, content, draftId, mode, userRole],
  );

  const handleApplyEdit = useCallback((edit: ProposedEdit) => {
    if (!editorRef.current) return;
    injectProposedEdit(editorRef.current, edit);
  }, []);

  const handleApplyComment = useCallback((comment: ProposedComment) => {
    if (!editorRef.current) return;
    injectInlineComment(editorRef.current, comment);
  }, []);

  const handleInsightApply = useCallback(
    (field: string, suggestion: string) => {
      const prompt = `Improve the ${field} section. Specific feedback: ${suggestion}`;
      const ctx = buildEditorContext(editorRef.current, content, mode);
      agentSendMessage(prompt, ctx);
      posthog.capture('proactive_insight_applied', {
        proposal_id: draftId,
        section: field,
      });
    },
    [agentSendMessage, content, draftId, mode],
  );

  const draftStatus = draft?.status;
  const typeLabel = draft
    ? (PROPOSAL_TYPE_LABELS[draft.proposalType as ProposalType] ?? draft.proposalType)
    : '';

  return {
    draftId,
    draft,
    error,
    isLoading,
    versions,
    permissions,
    readinessBadge,
    showJustificationFlow,
    setShowJustificationFlow,
    mode,
    setMode,
    scaffoldDismissed,
    setScaffoldDismissed,
    showScaffold,
    typeSpecific,
    handleTypeSpecificChange,
    handleTypeSpecificBlur,
    feedbackThemes,
    constitutionalResult,
    constitutionalLoading,
    sectionResults,
    sectionLoading,
    activeSuggestions,
    allSuggestions,
    suggestionMappings,
    resolvedCount,
    showVersionDiff,
    versionDiffVersion,
    changedFields,
    handleShowChanges,
    content,
    proactiveFlag,
    proactiveAnalysis,
    marginIndicators,
    draftStatus,
    typeLabel,
    teamRole,
    stakeAddress,
    agentMessages,
    agentIsStreaming,
    agentActiveToolCall,
    agentError,
    currentUserId: stakeAddress ?? 'anonymous',
    handleContentChange,
    handleSaveRetry,
    handleEditorReady,
    handleSlashCommand,
    handleCommand,
    handleChatSendMessage,
    handleApplyEdit,
    handleApplyComment,
    handleInsightApply,
    handleDiffAccept,
    handleDiffReject,
    handleSuggestionAccept,
    handleSuggestionReject,
    handleSuggestionAcceptAll,
    handleSuggestionRejectAll,
    isResponseRevision,
  };
}


