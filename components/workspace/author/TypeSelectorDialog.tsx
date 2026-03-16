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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  PROPOSAL_TYPE_LABELS,
  PROPOSAL_TYPE_DESCRIPTIONS,
  type ProposalType,
} from '@/lib/workspace/types';

const PROPOSAL_TYPES: ProposalType[] = [
  'InfoAction',
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitution',
];

interface TypeSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: ProposalType) => void;
  isPending: boolean;
}

export function TypeSelectorDialog({
  open,
  onOpenChange,
  onSelect,
  isPending,
}: TypeSelectorDialogProps) {
  const [selected, setSelected] = useState<ProposalType>('InfoAction');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose Governance Action Type</DialogTitle>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={(v: string) => setSelected(v as ProposalType)}
          className="space-y-3 py-2"
        >
          {PROPOSAL_TYPES.map((type) => (
            <div key={type} className="flex items-start gap-3">
              <RadioGroupItem value={type} id={`type-${type}`} className="mt-0.5" />
              <Label htmlFor={`type-${type}`} className="cursor-pointer space-y-0.5">
                <span className="font-medium text-sm">{PROPOSAL_TYPE_LABELS[type]}</span>
                <p className="text-xs text-muted-foreground leading-snug">
                  {PROPOSAL_TYPE_DESCRIPTIONS[type]}
                </p>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onSelect(selected)} disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
