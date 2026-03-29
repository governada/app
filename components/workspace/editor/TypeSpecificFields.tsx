'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProposalType } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Shared props for type-specific field sets
// ---------------------------------------------------------------------------

interface TypeSpecificFieldsProps {
  typeSpecific: Record<string, unknown>;
  onChange: (ts: Record<string, unknown>) => void;
  onBlur: () => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// TreasuryFields — withdrawal amount + receiving address
// ---------------------------------------------------------------------------

function TreasuryFields({ typeSpecific, onChange, onBlur, readOnly }: TypeSpecificFieldsProps) {
  return (
    <div className="space-y-4">
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
          disabled={readOnly}
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
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParameterChangeFields — parameter select + proposed value
// ---------------------------------------------------------------------------

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

function ParameterChangeFields({
  typeSpecific,
  onChange,
  onBlur,
  readOnly,
}: TypeSpecificFieldsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">Parameter Change Details</h3>
      <div className="space-y-1.5">
        <Label htmlFor="ts-param">Parameter Name</Label>
        <Select
          value={(typeSpecific.parameterName as string) ?? ''}
          onValueChange={(value) => {
            onChange({ ...typeSpecific, parameterName: value });
            onBlur();
          }}
          disabled={readOnly}
        >
          <SelectTrigger id="ts-param" aria-label="Select protocol parameter">
            <SelectValue placeholder="Select a parameter..." />
          </SelectTrigger>
          <SelectContent>
            {COMMON_PARAMETERS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ts-value">Proposed Value</Label>
        <Input
          id="ts-value"
          value={(typeSpecific.proposedValue as string) ?? ''}
          onChange={(e) => onChange({ ...typeSpecific, proposedValue: e.target.value })}
          onBlur={onBlur}
          placeholder="New value for the parameter"
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TypeSpecificFieldsPanel — conditionally renders the right fields
// ---------------------------------------------------------------------------

export interface TypeSpecificFieldsPanelProps {
  proposalType: ProposalType | string;
  typeSpecific: Record<string, unknown>;
  onChange: (ts: Record<string, unknown>) => void;
  onBlur: () => void;
  readOnly?: boolean;
}

export function TypeSpecificFieldsPanel({
  proposalType,
  typeSpecific,
  onChange,
  onBlur,
  readOnly,
}: TypeSpecificFieldsPanelProps) {
  if (proposalType === 'TreasuryWithdrawals') {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <TreasuryFields
          typeSpecific={typeSpecific}
          onChange={onChange}
          onBlur={onBlur}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (proposalType === 'ParameterChange') {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <ParameterChangeFields
          typeSpecific={typeSpecific}
          onChange={onChange}
          onBlur={onBlur}
          readOnly={readOnly}
        />
      </div>
    );
  }

  return null;
}
