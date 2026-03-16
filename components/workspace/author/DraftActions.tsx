'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, ShieldCheck, FileCode, History } from 'lucide-react';
import { useSaveVersion, useConstitutionalCheck, useCip108Preview } from '@/hooks/useDrafts';
import { ConstitutionalCheckPanel } from './ConstitutionalCheckPanel';
import { CIP108PreviewModal } from './CIP108PreviewModal';
import type {
  ProposalDraft,
  DraftVersion,
  ConstitutionalCheckResult,
  Cip108Document,
} from '@/lib/workspace/types';

interface DraftActionsProps {
  draft: ProposalDraft;
  versions: DraftVersion[];
}

export function DraftActions({ draft, versions }: DraftActionsProps) {
  const saveVersion = useSaveVersion(draft.id);
  const constitutionalCheck = useConstitutionalCheck();
  const cip108Preview = useCip108Preview();

  // Save version dialog state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [editSummary, setEditSummary] = useState('');

  // Constitutional check result
  const [checkResult, setCheckResult] = useState<ConstitutionalCheckResult | null>(null);

  // CIP-108 preview
  const [cip108Open, setCip108Open] = useState(false);
  const [cip108Data, setCip108Data] = useState<{
    document: Cip108Document;
    contentHash: string;
  } | null>(null);

  const handleSaveVersion = async () => {
    if (!versionName.trim()) return;
    await saveVersion.mutateAsync({
      versionName: versionName.trim(),
      editSummary: editSummary.trim() || undefined,
    });
    setVersionDialogOpen(false);
    setVersionName('');
    setEditSummary('');
  };

  const handleConstitutionalCheck = async () => {
    const result = await constitutionalCheck.mutateAsync({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
      proposalType: draft.proposalType,
      typeSpecific: draft.typeSpecific ?? undefined,
    });
    setCheckResult(result);
  };

  const handleCip108Preview = async () => {
    const result = await cip108Preview.mutateAsync({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
    });
    setCip108Data(result);
    setCip108Open(true);
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setVersionDialogOpen(true)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Version
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleConstitutionalCheck}
            disabled={constitutionalCheck.isPending || !draft.title}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {constitutionalCheck.isPending ? 'Checking...' : 'Constitutional Check'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleCip108Preview}
            disabled={cip108Preview.isPending || !draft.title}
          >
            <FileCode className="mr-2 h-4 w-4" />
            {cip108Preview.isPending ? 'Generating...' : 'CIP-108 Preview'}
          </Button>
        </CardContent>
      </Card>

      {/* Constitutional Check Result */}
      {checkResult && (
        <ConstitutionalCheckPanel
          result={checkResult}
          onRerun={handleConstitutionalCheck}
          isRunning={constitutionalCheck.isPending}
        />
      )}

      {/* Version History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No versions saved yet.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="text-xs border-b last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{v.versionNumber}</span>
                    <span className="text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{v.versionName}</p>
                  {v.editSummary && (
                    <p className="text-muted-foreground/70 italic">{v.editSummary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Version Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="version-name">Version Name</Label>
              <Input
                id="version-name"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="e.g. Added treasury details"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-summary">Edit Summary (optional)</Label>
              <Textarea
                id="edit-summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="What changed in this version?"
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVersionDialogOpen(false)}
              disabled={saveVersion.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveVersion}
              disabled={saveVersion.isPending || !versionName.trim()}
            >
              {saveVersion.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CIP-108 Preview Modal */}
      <CIP108PreviewModal open={cip108Open} onOpenChange={setCip108Open} data={cip108Data} />
    </div>
  );
}
