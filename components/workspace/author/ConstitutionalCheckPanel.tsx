'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw } from 'lucide-react';
import type { ConstitutionalCheckResult } from '@/lib/workspace/types';

interface ConstitutionalCheckPanelProps {
  result: ConstitutionalCheckResult;
  onRerun: () => void;
  isRunning: boolean;
}

const SCORE_CONFIG = {
  pass: {
    label: 'Pass',
    icon: ShieldCheck,
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    label: 'Warning',
    icon: ShieldAlert,
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  fail: {
    label: 'Fail',
    icon: ShieldX,
    badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400',
  },
};

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export function ConstitutionalCheckPanel({
  result,
  onRerun,
  isRunning,
}: ConstitutionalCheckPanelProps) {
  const config = SCORE_CONFIG[result.score];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            Constitutional Check
          </span>
          <Badge className={config.badgeClass}>{config.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.flags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No constitutional concerns identified.</p>
        ) : (
          <div className="space-y-2">
            {result.flags.map((flag, i) => (
              <div key={i} className="text-xs space-y-1 border-b last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {flag.article}
                    {flag.section ? `, ${flag.section}` : ''}
                  </Badge>
                  <Badge
                    className={`text-xs ${SEVERITY_BADGE[flag.severity] ?? SEVERITY_BADGE.info}`}
                  >
                    {flag.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-snug">{flag.concern}</p>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground/70 italic">
          This is an advisory AI analysis. The Constitutional Committee makes the final
          determination.
        </p>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onRerun}
          disabled={isRunning}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running...' : 'Run Check'}
        </Button>
      </CardContent>
    </Card>
  );
}
