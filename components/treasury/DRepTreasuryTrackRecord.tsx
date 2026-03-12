'use client';

import { useQuery } from '@tanstack/react-query';
import { formatAda } from '@/lib/treasury';
import type { DRepTreasuryRecord } from '@/lib/treasury';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DRepTreasuryTrackRecordProps {
  drepId: string;
}

export function DRepTreasuryTrackRecord({ drepId }: DRepTreasuryTrackRecordProps) {
  const { data, isLoading } = useQuery<{ record: DRepTreasuryRecord }>({
    queryKey: ['treasury-drep-record', drepId],
    queryFn: async () => {
      const res = await fetch(`/api/treasury/drep-record?drepId=${encodeURIComponent(drepId)}`);
      if (!res.ok) throw new Error('Failed to fetch DRep treasury record');
      return res.json();
    },
    enabled: !!drepId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  const record = data?.record;
  if (!record || record.totalProposals === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          <p className="text-sm">
            You haven&apos;t voted on any treasury proposals yet. Your track record will appear here
            once you do.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Your Treasury Track Record</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-semibold text-emerald-400">{record.approvedCount}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-[10px] text-muted-foreground">₳{formatAda(record.approvedAda)}</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-red-400">{record.opposedCount}</p>
            <p className="text-xs text-muted-foreground">Opposed</p>
            <p className="text-[10px] text-muted-foreground">₳{formatAda(record.opposedAda)}</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-muted-foreground">{record.abstainedCount}</p>
            <p className="text-xs text-muted-foreground">Abstained</p>
          </div>
        </div>

        {record.judgmentScore !== null && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Judgment Score</span>
              <span className="text-sm font-semibold">{record.judgmentScore}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Based on accountability outcomes of proposals you approved
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
