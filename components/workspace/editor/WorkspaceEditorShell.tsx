'use client';

import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { posthog } from '@/lib/posthog';
import { StudioProvider, useStudio } from '@/components/studio/StudioProvider';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { StudioPanel } from '@/components/studio/StudioPanel';
import { WorkspacePanels } from '@/components/workspace/layout/WorkspacePanels';
import { ProposalEditor } from '@/components/workspace/editor/ProposalEditor';
import { ChangeSinceBadge } from '@/components/workspace/editor/ChangeSinceBadge';
import { ReReviewBanner } from '@/components/workspace/author/ReReviewBanner';
import { TypeSpecificFieldsPanel } from '@/components/workspace/editor/TypeSpecificFields';
import { AgentChatPanel } from '@/components/workspace/agent/AgentChatPanel';
import { StatusBar } from '@/components/workspace/layout/StatusBar';
import { SaveErrorBanner } from '@/components/workspace/layout/SaveErrorBanner';
import { RevisionJustificationFlow } from '@/components/workspace/editor/RevisionJustificationFlow';
import { ScaffoldForm } from '@/components/workspace/author/ScaffoldForm';
import { ReadinessPanel } from '@/components/workspace/author/ReadinessPanel';
import { QualityPulse } from '@/components/workspace/author/QualityPulse';
import { ProactiveInsight } from '@/components/workspace/author/ProactiveInsight';
import { ProactiveInsightStack } from '@/components/workspace/author/ProactiveInsightStack';
import { ProposalAlignmentCard } from '@/components/intelligence/ProposalAlignmentCard';
import { VersionCompareDialog } from '@/components/workspace/author/VersionCompareDialog';
import { AuthorBrief } from '@/components/intelligence/AuthorBrief';
import { SuggestionResolutionBar } from '@/components/workspace/editor/SuggestionResolutionBar';
import { useRegisterEditorCommands } from '@/hooks/useRegisterEditorCommands';
import type { WorkspaceEditorController } from '@/app/workspace/editor/_hooks/useWorkspaceEditorController';

function LineageBanner({ supersedesId }: { supersedesId: string }) {
  const { data, isLoading } = useQuery<{ draft: { title: string; status: string } }>({
    queryKey: ['author-draft-lineage', supersedesId],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      try {
        const { getStoredSession } = await import('@/lib/supabaseAuth');
        const token = getStoredSession();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {
        // No session
      }
      const res = await fetch(`/api/workspace/drafts/${encodeURIComponent(supersedesId)}`, {
        headers,
      });
      if (!res.ok) throw new Error('Source draft not found');
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) return null;

  const sourceTitle = data?.draft?.title;
  const sourceStatus = data?.draft?.status;

  return (
    <div className="border-l-2 border-teal-500/60 pl-3 py-1.5 mb-4">
      <p className="text-xs text-muted-foreground">
        <span className="mr-1">{'\u21A9'}</span>
        Based on:{' '}
        {sourceTitle ? (
          <>
            <a
              href={`/workspace/author/${supersedesId}`}
              className="text-teal-400 hover:text-teal-300 underline underline-offset-2"
            >
              {sourceTitle}
            </a>
            {sourceStatus && (
              <span className="ml-1.5 text-muted-foreground/70">
                ({sourceStatus.replace(/_/g, ' ')})
              </span>
            )}
          </>
        ) : (
          <span className="italic">a previous draft</span>
        )}
      </p>
    </div>
  );
}

function AuthorPanelWrapper({
  agentContent,
  intelContent,
  readinessContent,
  headerContent,
}: {
  agentContent: ReactNode;
  intelContent?: ReactNode;
  readinessContent?: ReactNode;
  headerContent?: ReactNode;
}) {
  const { panelOpen, activePanel, panelWidth, closePanel, togglePanel, setPanelWidth } =
    useStudio();

  return (
    <StudioPanel
      isOpen={panelOpen}
      onClose={closePanel}
      activeTab={activePanel}
      onTabChange={(tab) => togglePanel(tab)}
      width={panelWidth}
      onWidthChange={setPanelWidth}
      agentContent={agentContent}
      intelContent={intelContent}
      readinessContent={readinessContent}
      headerContent={headerContent}
    />
  );
}

function AuthorHeaderWrapper(
  props: React.ComponentProps<typeof StudioHeader> & {
    readiness?: { level: 'low' | 'moderate' | 'high' | 'strong'; blockerCount: number };
  },
) {
  const { togglePanel } = useStudio();

  return <StudioHeader {...props} onReadinessClick={() => togglePanel('readiness')} />;
}

function AuthorActionBarWrapper({
  statusInfo,
  contextActions,
}: {
  statusInfo: ReactNode;
  contextActions?: ReactNode;
}) {
  const { panelOpen, activePanel, togglePanel } = useStudio();

  return (
    <StudioActionBar
      activePanel={panelOpen ? activePanel : null}
      onPanelToggle={togglePanel}
      statusInfo={statusInfo}
      contextActions={contextActions}
    />
  );
}

function EditorPanelShortcuts() {
  const { togglePanel } = useStudio();
  useRegisterEditorCommands({
    onConstitutionalCheck: () => togglePanel('readiness'),
    onCIP108Preview: () => togglePanel('intel'),
  });
  return null;
}

export function WorkspaceEditorShell({
  controller,
}: {
  controller: WorkspaceEditorController;
}) {
  const {
    draftId,
    draft,
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
    stakeAddress,
    agentMessages,
    agentIsStreaming,
    agentActiveToolCall,
    agentError,
    currentUserId,
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
  } = controller;

  if (!draft) return null;

  const statusBarNode = useMemo(() => {
    const completenessChecks = [
      !!content.title,
      !!content.abstract,
      !!content.motivation,
      !!content.rationale,
      content.title.length > 10,
      content.abstract.length > 50,
    ];
    const done = completenessChecks.filter(Boolean).length;

    return (
      <StatusBar
        completeness={{ done, total: completenessChecks.length }}
        community={{
          reviewerCount: 0,
          themeCount: feedbackThemes.length,
        }}
        userStatus={
          draftStatus === 'draft' ? 'Draft' : (draftStatus?.replace(/_/g, ' ') ?? 'Draft')
        }
        showSaveStatus
      />
    );
  }, [content, draftStatus, feedbackThemes.length]);

  const toolbarActions = permissions.canEdit ? (
    <div className="flex items-center gap-2">
      {versions && versions.length >= 2 && <VersionCompareDialog versions={versions} />}
      <button
        onClick={() => setShowJustificationFlow(true)}
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
      >
        Save Version
      </button>
    </div>
  ) : undefined;

  const qualityPulseNode = draft ? (
    <>
      <QualityPulse
        fields={content}
        sectionResults={sectionResults}
        sectionLoading={sectionLoading}
        constitutionalCheck={constitutionalResult}
        constitutionalLoading={constitutionalLoading}
        feedbackThemeCount={feedbackThemes.length}
        onConstitutionalClick={() => {}}
      />
      {permissions.canEdit && proactiveFlag ? (
        <ProactiveInsightStack
          insights={proactiveAnalysis.insights}
          isAnalyzing={proactiveAnalysis.isAnalyzing}
          fields={content}
          onApply={(_insightId, field, suggestion) => handleInsightApply(field, suggestion)}
          onDismiss={proactiveAnalysis.dismissInsight}
        />
      ) : permissions.canEdit ? (
        <ProactiveInsight
          sectionResults={sectionResults}
          isAnalyzing={Object.values(sectionLoading).some(Boolean)}
          fields={content}
          onApply={handleInsightApply}
        />
      ) : null}
    </>
  ) : null;

  const agentChatNode = (
    <AgentChatPanel
      sendMessage={handleChatSendMessage}
      messages={agentMessages}
      isStreaming={agentIsStreaming}
      activeToolCall={agentActiveToolCall}
      error={agentError}
      onApplyEdit={permissions.readOnly ? undefined : handleApplyEdit}
      onApplyComment={handleApplyComment}
    />
  );

  return (
    <>
      {showJustificationFlow && draft && versions && versions.length > 0 && (
        <RevisionJustificationFlow
          currentContent={{
            title: draft.title,
            abstract: draft.abstract,
            motivation: draft.motivation,
            rationale: draft.rationale,
            proposalType: draft.proposalType,
          }}
          previousContent={versions[versions.length - 1]?.content}
          feedbackThemes={feedbackThemes ?? []}
          onSubmit={() => setShowJustificationFlow(false)}
          onSkip={() => setShowJustificationFlow(false)}
          onCancel={() => setShowJustificationFlow(false)}
        />
      )}

      <StudioProvider>
        <EditorPanelShortcuts />
        <WorkspacePanels
          layoutId="editor"
          toolbar={
            <AuthorHeaderWrapper
              backLabel="Back to drafts"
              backHref="/workspace/author"
              title={draft.title || 'Untitled proposal'}
              titleTransitionName={draftId ? `draft-title-${draftId}` : undefined}
              proposalType={typeLabel}
              showModeSwitch={permissions.canEdit && !permissions.stageReadOnly}
              mode={mode}
              onModeChange={permissions.canEdit && !permissions.stageReadOnly ? setMode : undefined}
              actions={toolbarActions}
              readiness={readinessBadge}
            />
          }
          main={
            <div className="max-w-3xl mx-auto px-4 py-4 lg:px-6 lg:py-6 transition-opacity duration-150">
              {draft.supersedesId && <LineageBanner supersedesId={draft.supersedesId} />}
              {!permissions.isOwner && stakeAddress && (
                <ReReviewBanner
                  draft={draft}
                  viewerStakeAddress={stakeAddress}
                  onShowChanges={handleShowChanges}
                />
              )}
              {showVersionDiff && changedFields.length > 0 && versionDiffVersion && (
                <ChangeSinceBadge
                  changedFields={changedFields}
                  reviewedAtVersion={versionDiffVersion}
                  currentVersion={draft.currentVersion ?? 0}
                />
              )}
              <SaveErrorBanner onRetry={handleSaveRetry} />
              {showScaffold ? (
                <ScaffoldForm draft={draft} onComplete={() => setScaffoldDismissed(true)} />
              ) : (
                <>
                  {isResponseRevision && (suggestionMappings.length > 0 || resolvedCount > 0) && (
                    <SuggestionResolutionBar
                      mappings={suggestionMappings}
                      activeCount={suggestionMappings.length}
                      resolvedCount={resolvedCount}
                      onAccept={handleSuggestionAccept}
                      onReject={handleSuggestionReject}
                      onAcceptAll={handleSuggestionAcceptAll}
                      onRejectAll={handleSuggestionRejectAll}
                      proposalId={draftId ?? undefined}
                    />
                  )}
                  <ProposalEditor
                    content={content}
                    mode={mode}
                    readOnly={permissions.readOnly || mode === 'review'}
                    onContentChange={permissions.readOnly ? undefined : handleContentChange}
                    onSlashCommand={handleSlashCommand}
                    onCommand={handleCommand}
                    onDiffAccept={handleDiffAccept}
                    onDiffReject={handleDiffReject}
                    showSuggestEdit={!permissions.isOwner && mode === 'review'}
                    onSuggestEdit={(_editId, _proposedText, explanation) => {
                      posthog.capture('tracked_change_proposed', {
                        proposal_id: draftId,
                        edit_id: _editId,
                        has_explanation: !!explanation,
                      });
                    }}
                    currentUserId={currentUserId}
                    onEditorReady={handleEditorReady}
                    marginIndicators={marginIndicators}
                  />
                  <TypeSpecificFieldsPanel
                    proposalType={draft.proposalType}
                    typeSpecific={typeSpecific}
                    onChange={handleTypeSpecificChange}
                    onBlur={handleTypeSpecificBlur}
                    readOnly={permissions.readOnly || mode === 'review'}
                  />
                </>
              )}
            </div>
          }
          context={
            <AuthorPanelWrapper
              agentContent={agentChatNode}
              intelContent={
                draft ? (
                  <AuthorBrief
                    draft={draft}
                    draftId={draftId ?? ''}
                    constitutionalResult={constitutionalResult}
                    canEdit={permissions.canEdit}
                  />
                ) : undefined
              }
              readinessContent={
                draftId ? (
                  <>
                    <ReadinessPanel draftId={draftId} />
                    <ProposalAlignmentCard className="mt-4" />
                  </>
                ) : undefined
              }
              headerContent={qualityPulseNode}
            />
          }
          statusBar={<AuthorActionBarWrapper statusInfo={statusBarNode} />}
        />
      </StudioProvider>
    </>
  );
}




