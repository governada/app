'use client';

/**
 * ReviewWorkspace — Proposal review workspace with right sidebar tabs.
 *
 * Right sidebar tabs:
 * - "Notes" — placeholder for ProposalNotes + DecisionJournal (future)
 * - "Research" — AI research assistant (feature-flagged)
 *
 * The Research tab only appears when the `research_assistant` flag is enabled.
 */

import { useState } from 'react';
import { StickyNote, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFeatureFlag } from '@/components/FeatureGate';
import { ResearchAssistant } from './ResearchAssistant';

interface ReviewWorkspaceProps {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string;
}

export function ReviewWorkspaceSidebar({
  proposalTxHash,
  proposalIndex,
  proposalTitle,
}: ReviewWorkspaceProps) {
  const researchEnabled = useFeatureFlag('research_assistant');
  const [activeTab, setActiveTab] = useState('notes');

  // While flag is loading, default to notes-only view
  const showResearch = researchEnabled === true;

  return (
    <div className="flex h-full flex-col">
      {showResearch ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <div className="shrink-0 px-3 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="notes" className="flex-1 gap-1.5">
                <StickyNote className="size-3.5" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="research" className="flex-1 gap-1.5">
                <Sparkles className="size-3.5" />
                Research
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="notes" className="flex-1 overflow-y-auto px-4 py-3">
            <NotesPlaceholder />
          </TabsContent>

          <TabsContent value="research" className="flex-1 overflow-hidden">
            <ResearchAssistant
              proposalTxHash={proposalTxHash}
              proposalIndex={proposalIndex}
              proposalTitle={proposalTitle}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <NotesPlaceholder />
        </div>
      )}
    </div>
  );
}

/** Placeholder for ProposalNotes + DecisionJournal (to be built). */
function NotesPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <StickyNote className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Proposal Notes</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Notes and decision journal coming soon. Use the Research tab to analyze this proposal with
        AI.
      </p>
    </div>
  );
}
