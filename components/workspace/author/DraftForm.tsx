'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useUpdateDraft } from '@/hooks/useDrafts';
import type { ProposalDraft } from '@/lib/workspace/types';

interface DraftFormProps {
  draft: ProposalDraft;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved';

export function DraftForm({ draft }: DraftFormProps) {
  const updateDraft = useUpdateDraft(draft.id);

  // Local form state
  const [title, setTitle] = useState(draft.title);
  const [abstract, setAbstract] = useState(draft.abstract);
  const [motivation, setMotivation] = useState(draft.motivation);
  const [rationale, setRationale] = useState(draft.rationale);
  const [typeSpecific, setTypeSpecific] = useState<Record<string, unknown>>(
    draft.typeSpecific ?? {},
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Track if any field was changed since last save
  const dirtyRef = useRef(false);

  // Sync from server on fresh data
  useEffect(() => {
    setTitle(draft.title);
    setAbstract(draft.abstract);
    setMotivation(draft.motivation);
    setRationale(draft.rationale);
    setTypeSpecific(draft.typeSpecific ?? {});
    setSaveStatus('saved');
    dirtyRef.current = false;
  }, [
    draft.id,
    draft.updatedAt,
    draft.title,
    draft.abstract,
    draft.motivation,
    draft.rationale,
    draft.typeSpecific,
  ]);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setSaveStatus('unsaved');
    }
  }, []);

  const handleSave = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!dirtyRef.current) return;
      setSaveStatus('saving');
      try {
        await updateDraft.mutateAsync(fields);
        dirtyRef.current = false;
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    },
    [updateDraft],
  );

  const handleFieldBlur = useCallback(() => {
    if (!dirtyRef.current) return;
    handleSave({
      title,
      abstract,
      motivation,
      rationale,
      typeSpecific: Object.keys(typeSpecific).length > 0 ? typeSpecific : undefined,
    });
  }, [title, abstract, motivation, rationale, typeSpecific, handleSave]);

  return (
    <div className="space-y-5">
      {/* Save status indicator */}
      <div className="flex justify-end">
        <span
          className={`text-xs font-medium ${
            saveStatus === 'saved'
              ? 'text-emerald-600 dark:text-emerald-400'
              : saveStatus === 'saving'
                ? 'text-muted-foreground'
                : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'unsaved' && 'Unsaved changes'}
        </span>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="draft-title">Title</Label>
        <Input
          id="draft-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          onBlur={handleFieldBlur}
          maxLength={200}
          placeholder="Proposal title"
        />
        <CharCount current={title.length} max={200} />
      </div>

      {/* Abstract */}
      <div className="space-y-1.5">
        <Label htmlFor="draft-abstract">Abstract</Label>
        <Textarea
          id="draft-abstract"
          value={abstract}
          onChange={(e) => {
            setAbstract(e.target.value);
            markDirty();
          }}
          onBlur={handleFieldBlur}
          maxLength={2000}
          rows={4}
          placeholder="Brief summary of what this proposal does"
        />
        <CharCount current={abstract.length} max={2000} />
      </div>

      {/* Motivation */}
      <div className="space-y-1.5">
        <Label htmlFor="draft-motivation">Motivation</Label>
        <Textarea
          id="draft-motivation"
          value={motivation}
          onChange={(e) => {
            setMotivation(e.target.value);
            markDirty();
          }}
          onBlur={handleFieldBlur}
          maxLength={10000}
          rows={8}
          placeholder="Why is this proposal needed? What problem does it solve?"
        />
        <CharCount current={motivation.length} max={10000} />
      </div>

      {/* Rationale */}
      <div className="space-y-1.5">
        <Label htmlFor="draft-rationale">Rationale</Label>
        <Textarea
          id="draft-rationale"
          value={rationale}
          onChange={(e) => {
            setRationale(e.target.value);
            markDirty();
          }}
          onBlur={handleFieldBlur}
          maxLength={10000}
          rows={8}
          placeholder="Why is this the right approach? Why should DReps vote Yes?"
        />
        <CharCount current={rationale.length} max={10000} />
      </div>

      {/* Type-specific fields */}
      {draft.proposalType === 'TreasuryWithdrawals' && (
        <TreasuryFields
          typeSpecific={typeSpecific}
          onChange={(ts) => {
            setTypeSpecific(ts);
            markDirty();
          }}
          onBlur={handleFieldBlur}
        />
      )}
      {draft.proposalType === 'ParameterChange' && (
        <ParameterChangeFields
          typeSpecific={typeSpecific}
          onChange={(ts) => {
            setTypeSpecific(ts);
            markDirty();
          }}
          onBlur={handleFieldBlur}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character count
// ---------------------------------------------------------------------------

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <p
      className={`text-xs ${current > max * 0.9 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
    >
      {current} / {max}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Type-specific field sets
// ---------------------------------------------------------------------------

interface TypeSpecificFieldsProps {
  typeSpecific: Record<string, unknown>;
  onChange: (ts: Record<string, unknown>) => void;
  onBlur: () => void;
}

function TreasuryFields({ typeSpecific, onChange, onBlur }: TypeSpecificFieldsProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="text-sm font-semibold text-muted-foreground">Treasury Details</h3>
      <div className="space-y-1.5">
        <Label htmlFor="ts-amount">Withdrawal Amount (ADA)</Label>
        <Input
          id="ts-amount"
          type="number"
          min={0}
          value={(typeSpecific.withdrawalAmountAda as number) ?? ''}
          onChange={(e) =>
            onChange({
              ...typeSpecific,
              withdrawalAmountAda: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          onBlur={onBlur}
          placeholder="e.g. 100000"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ts-address">Receiving Address</Label>
        <Input
          id="ts-address"
          value={(typeSpecific.receivingAddress as string) ?? ''}
          onChange={(e) => onChange({ ...typeSpecific, receivingAddress: e.target.value })}
          onBlur={onBlur}
          placeholder="addr1..."
        />
      </div>
    </div>
  );
}

const COMMON_PARAMETERS = [
  'maxBlockBodySize',
  'maxTxSize',
  'maxBlockHeaderSize',
  'keyDeposit',
  'poolDeposit',
  'eMax',
  'nOpt',
  'a0',
  'rho',
  'tau',
  'minPoolCost',
  'coinsPerUTxOByte',
  'maxCollateralInputs',
  'maxValSize',
  'collateralPercentage',
  'govActionLifetime',
  'govActionDeposit',
  'dRepDeposit',
  'dRepActivity',
  'committeeMinSize',
  'committeeMaxTermLength',
];

function ParameterChangeFields({ typeSpecific, onChange, onBlur }: TypeSpecificFieldsProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="text-sm font-semibold text-muted-foreground">Parameter Change Details</h3>
      <div className="space-y-1.5">
        <Label htmlFor="ts-param">Parameter Name</Label>
        <select
          id="ts-param"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={(typeSpecific.parameterName as string) ?? ''}
          onChange={(e) => onChange({ ...typeSpecific, parameterName: e.target.value })}
          onBlur={onBlur}
        >
          <option value="">Select a parameter...</option>
          {COMMON_PARAMETERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ts-value">Proposed Value</Label>
        <Input
          id="ts-value"
          value={(typeSpecific.proposedValue as string) ?? ''}
          onChange={(e) => onChange({ ...typeSpecific, proposedValue: e.target.value })}
          onBlur={onBlur}
          placeholder="New value for the parameter"
        />
      </div>
    </div>
  );
}
