'use client';

import { Newspaper, Shield, Award } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewCard {
  icon: typeof Newspaper;
  title: string;
  description: string;
  preview: React.ReactNode;
}

interface UnlockPreviewProps {
  currentEpoch?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UnlockPreview — "What you'll see as a citizen" preview cards.
 *
 * Shown on the match results page after results and before the wallet
 * connect prompt. Gives anonymous users a taste of what awaits them
 * as authenticated citizens — briefings, delegation health, civic identity.
 */
export function UnlockPreview({ currentEpoch }: UnlockPreviewProps) {
  const cards: PreviewCard[] = [
    {
      icon: Newspaper,
      title: 'Your Governance Briefing',
      description:
        'Every ~5 days, get a personalized briefing: what happened, how your representative voted, treasury updates.',
      preview: <BriefingMockup epoch={currentEpoch} />,
    },
    {
      icon: Shield,
      title: 'Your Delegation Health',
      description:
        'Monitor your representative\u2019s performance. Get alerts when something needs attention.',
      preview: <HealthMockup />,
    },
    {
      icon: Award,
      title: 'Your Civic Identity',
      description:
        'Build your governance reputation. Track milestones, streaks, and your impact over time.',
      preview: <IdentityMockup />,
    },
  ];

  return (
    <div className="space-y-4 pt-2">
      {/* Section header */}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-foreground/90">
          What you&apos;ll see as a citizen
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect your wallet to unlock your personalized governance dashboard
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 space-y-3"
          >
            {/* Icon + title */}
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <card.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <h4 className="text-xs font-semibold text-foreground">{card.title}</h4>
            </div>

            {/* Description */}
            <p className="text-[11px] text-muted-foreground leading-relaxed">{card.description}</p>

            {/* Visual preview */}
            <div className="pt-1">{card.preview}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini mockups
// ---------------------------------------------------------------------------

/** Mini briefing card mockup with blurred preview lines */
function BriefingMockup({ epoch }: { epoch?: number }) {
  return (
    <div className="rounded-lg border border-border/30 bg-background/50 p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-[10px] font-medium text-foreground/70">Epoch {epoch ?? '...'}</span>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full rounded bg-muted-foreground/10 blur-[1px]" />
        <div className="h-2 w-3/4 rounded bg-muted-foreground/10 blur-[1px]" />
      </div>
    </div>
  );
}

/** Mini health badge mockup */
function HealthMockup() {
  return (
    <div className="rounded-lg border border-border/30 bg-background/50 p-2.5">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
        <span className="text-[10px] font-medium text-emerald-500/90">Healthy</span>
      </div>
    </div>
  );
}

/** Mini civic identity stats mockup */
function IdentityMockup() {
  return (
    <div className="rounded-lg border border-border/30 bg-background/50 p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Citizen since:</span>
        <span className="text-[10px] font-medium text-foreground/70">Today</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">First milestone:</span>
        <span className="text-[10px] font-medium text-foreground/70">
          Find a representative &#10003;
        </span>
      </div>
    </div>
  );
}
