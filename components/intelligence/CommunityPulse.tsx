'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface TopicHeatmapEntry {
  topic: string;
  count: number;
  trend: number;
}

interface ArchetypeEntry {
  archetype: string;
  count: number;
  percentage: number;
}

interface PulseData {
  epoch: number;
  totalSessions: number;
  topicHeatmap: TopicHeatmapEntry[];
  archetypeDistribution: ArchetypeEntry[];
  communityCentroid: number[];
  temperature: { value: number; band: string };
  updatedAt: string | null;
}

interface CommunityPulseProps {
  className?: string;
}

/* ─── Topic label prettifier ───────────────────────────── */

const TOPIC_LABELS: Record<string, string> = {
  treasury: 'Treasury',
  innovation: 'Innovation',
  security: 'Security',
  transparency: 'Transparency',
  decentralization: 'Decentralization',
  'developer-funding': 'Developer Funding',
  'community-growth': 'Community Growth',
  constitutional: 'Constitutional Compliance',
};

function topicLabel(key: string): string {
  return TOPIC_LABELS[key] ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Archetype color map ─────────────────────────────── */

const ARCHETYPE_COLORS: Record<string, string> = {
  'The Guardian': '#dc2626',
  'The Fiscal Hawk': '#dc2626',
  'The Prudent Steward': '#dc2626',
  'The Moderate': '#94a3b8',
  'The Builder': '#10b981',
  'The Growth Architect': '#10b981',
  'The Catalyst': '#10b981',
  'The Pragmatist': '#94a3b8',
  'The Federalist': '#a855f7',
  'The Power Distributor': '#a855f7',
  'The Decentralizer': '#a855f7',
  'The Balanced Voice': '#94a3b8',
  'The Sentinel': '#f59e0b',
  'The Protocol Guardian': '#f59e0b',
  'The Cautious Architect': '#f59e0b',
  'The Measured Thinker': '#94a3b8',
  'The Pioneer': '#06b6d4',
  'The Changemaker': '#06b6d4',
  'The Explorer': '#06b6d4',
  'The Curious Mind': '#94a3b8',
  'The Beacon': '#3b82f6',
  'The Open Advocate': '#3b82f6',
  'The Transparency Champion': '#3b82f6',
  'The Thoughtful Observer': '#94a3b8',
};

function archetypeColor(name: string): string {
  return ARCHETYPE_COLORS[name] ?? '#94a3b8';
}

/* ─── Fetcher ──────────────────────────────────────────── */

async function fetchCommunityPulse(): Promise<PulseData> {
  const res = await fetch('/api/community/pulse');
  if (!res.ok) throw new Error(`Pulse fetch failed: ${res.status}`);
  return res.json();
}

/* ─── Sub-components ───────────────────────────────────── */

function TopicHeatmap({ topics }: { topics: TopicHeatmapEntry[] }) {
  if (topics.length === 0) return null;
  const maxCount = topics[0]?.count ?? 1;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        What the community cares about
      </p>
      <div className="space-y-1">
        {topics.slice(0, 8).map((entry, i) => {
          const pct = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
          const isTop3 = i < 3;

          return (
            <div key={entry.topic} className="flex items-center gap-2 h-7">
              <span className="text-xs text-muted-foreground w-28 truncate shrink-0">
                {topicLabel(entry.topic)}
              </span>
              <div className="flex-1 h-3 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isTop3 ? 'bg-primary' : 'bg-white/20',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right shrink-0">
                {entry.count}
              </span>
              <TrendIndicator trend={entry.trend} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: number }) {
  if (trend > 0) {
    return <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />;
  }
  if (trend < 0) {
    return <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />;
  }
  return <Minus className="h-3 w-3 text-white/30 shrink-0" />;
}

function ArchetypeDistribution({ archetypes }: { archetypes: ArchetypeEntry[] }) {
  if (archetypes.length === 0) return null;

  // Show top 4, group rest as "Other"
  const top4 = archetypes.slice(0, 4);
  const otherCount = archetypes.slice(4).reduce((sum, a) => sum + a.count, 0);
  const totalCount = archetypes.reduce((sum, a) => sum + a.count, 0);
  const otherPct = totalCount > 0 ? Math.round((otherCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Community archetypes
      </p>
      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-white/[0.06]">
        {top4.map((entry) => (
          <div
            key={entry.archetype}
            className="h-full transition-all duration-500"
            style={{
              width: `${entry.percentage}%`,
              backgroundColor: archetypeColor(entry.archetype),
              opacity: 0.8,
            }}
          />
        ))}
        {otherCount > 0 && (
          <div
            className="h-full bg-white/20 transition-all duration-500"
            style={{ width: `${otherPct}%` }}
          />
        )}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {top4.map((entry) => (
          <div key={entry.archetype} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: archetypeColor(entry.archetype) }}
            />
            <span className="text-[11px] text-muted-foreground truncate">
              {entry.archetype} {entry.percentage}%
            </span>
          </div>
        ))}
        {otherCount > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
            <span className="text-[11px] text-muted-foreground">Other {otherPct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TemperatureGauge({ value, band }: { value: number; band: string }) {
  const bandLabel =
    band === 'cold' ? 'Cold' : band === 'cool' ? 'Cool' : band === 'warm' ? 'Warm' : 'Hot';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Governance temperature
        </p>
        <span className="text-xs text-muted-foreground">{bandLabel}</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(to right, #3b82f6, #06b6d4, #f59e0b, #ef4444)',
          }}
        />
        {/* Value indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md transition-all duration-500"
          style={{
            left: `calc(${Math.min(Math.max(value, 0), 100)}% - 6px)`,
            backgroundColor: '#fff',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────── */

export function CommunityPulse({ className }: CommunityPulseProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['community-pulse'],
    queryFn: fetchCommunityPulse,
    staleTime: 300_000, // 5 min — matches server cache
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-3 animate-pulse', className)}>
        <div className="h-3 bg-white/[0.06] rounded w-3/4" />
        <div className="h-3 bg-white/[0.06] rounded w-1/2" />
        <div className="h-3 bg-white/[0.06] rounded w-2/3" />
      </div>
    );
  }

  if (error || !data || data.totalSessions === 0) {
    return null; // Don't render anything if no data
  }

  return (
    <div className={cn('space-y-4', className)}>
      <TopicHeatmap topics={data.topicHeatmap} />
      <ArchetypeDistribution archetypes={data.archetypeDistribution} />
      <TemperatureGauge value={data.temperature.value} band={data.temperature.band} />
      {data.totalSessions > 0 && (
        <p className="text-[10px] text-white/30 text-center">
          Based on {data.totalSessions} citizen{data.totalSessions !== 1 ? 's' : ''} this epoch
        </p>
      )}
    </div>
  );
}
