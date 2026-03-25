'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Sparkles, ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import { useDiscoveryHub } from '@/components/discovery/DiscoveryHubContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type CompassProgression,
  type CompassState,
  getCompassState,
  getCompassProgression,
  trackCompassPageView,
} from '@/lib/funnel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageKey = 'proposals' | 'representatives' | 'pools' | 'committee' | 'treasury' | 'health';

interface CompassGuideProps {
  /** Which governance page this is rendered on */
  page: PageKey;
  /** Server-fetched briefing data — pre-generated narrative content */
  briefing?: {
    headline: string;
    narrative: string;
  } | null;
  /** Current count of active proposals (for proposals page context) */
  proposalCount?: number;
  /** Current count of active dreps (for representatives page context) */
  drepCount?: number;
  /** Current count of governance-active pools */
  poolCount?: number;
}

// ---------------------------------------------------------------------------
// Seneca's narratives per page x progression
//
// Voice: Stoic philosopher and political advisor. Measured, direct, uses
// questions to guide thinking. Practical wisdom over platitudes. The kind
// of advisor who tells you a hard truth wrapped in an observation.
// Occasionally quotes himself (as Seneca would).
// ---------------------------------------------------------------------------

const SENECA_NARRATIVES: Record<
  PageKey,
  Record<CompassProgression, { text: string; cta?: { label: string; href: string } }>
> = {
  proposals: {
    first_visit: {
      text: 'Every line below is a decision that will outlast the epoch in which it was made. Some redistribute millions from the common treasury. Others rewrite the rules of the protocol itself. The question is not whether these matter. The question is whether you will let others decide for you.',
    },
    exploring: {
      text: 'You have been watching. Good. But the difference between a spectator and a citizen is a single act of commitment. I can map your values to these proposals in sixty seconds. The only cost is honesty.',
      cta: { label: 'Map my values', href: '/match' },
    },
    quiz_completed: {
      text: 'Your convictions are on record. The representatives who matched your values are casting votes on these proposals right now. Connect your wallet and I will show you whether they are keeping faith \u2014 or whether your trust is misplaced.',
      cta: { label: 'Connect your wallet', href: '/match' },
    },
    connected: {
      text: 'The open decisions before you. I will mark anything that conflicts with what you have told me you believe.',
    },
  },
  representatives: {
    first_visit: {
      text: 'These are the people who speak for Cardano when votes are called. Some have shown up for every ballot. Others registered, collected delegation, and vanished. What you see below are records, not promises. Judge by what they have done, not what they say they will do.',
    },
    exploring: {
      text: '"It is not that we have a short time to live, but that we waste a great deal of it." You have been browsing when you could be choosing. Tell me what you stand for and I will show you who actually stands with you.',
      cta: { label: 'Match me', href: '/match' },
    },
    quiz_completed: {
      text: 'I have measured these representatives against your stated values. But a number only tells part of the story. Connect your wallet and I will reveal the full alignment \u2014 where you converge, where you diverge, and what that costs you.',
      cta: { label: 'See full alignment', href: '/match' },
    },
    connected: {
      text: 'Your representatives and their recent conduct. Where their votes diverge from your priorities, I will tell you plainly.',
    },
  },
  pools: {
    first_visit: {
      text: 'Most choose their stake pool for yield alone. But every pool that votes on governance makes your staking decision a political act \u2014 whether you intended it or not. Below are the ones who take that second responsibility seriously. Worth knowing which side of history your stake supports.',
    },
    exploring: {
      text: 'What if the pool earning your rewards also voted your conscience? That is not idealism. It is available right now. Let me show you.',
      cta: { label: 'Find aligned pools', href: '/match' },
    },
    quiz_completed: {
      text: 'I have found pools that match both your governance values and your participation standards. Connect your wallet to see how they compare to your current delegation. You may be leaving representation on the table while collecting only yield.',
      cta: { label: 'Compare pools', href: '/match' },
    },
    connected: {
      text: 'Governance-active pools, ranked. Where a pool better matches your values than your current delegation, I will say so.',
    },
  },
  committee: {
    first_visit: {
      text: 'The Constitutional Committee is the last guardrail. Their sole purpose: ensure no proposal violates the founding principles. Below is their record \u2014 who deliberates, who rubber-stamps, and who has yet to cast a single vote. Accountability begins with visibility.',
    },
    exploring: {
      text: '"No person is free who is enslaved by ignorance." You have been learning how the machinery works. The committee is where constitutional fidelity is tested. Connect your wallet and I will trace how their rulings ripple through your delegation chain.',
      cta: { label: 'See the ripple', href: '/match' },
    },
    quiz_completed: {
      text: 'You see the structure now. Connect your wallet and I will map how committee decisions flow into the proposals your matched representatives are voting on. The chain of accountability matters more than any single vote.',
      cta: { label: 'Connect to trace', href: '/match' },
    },
    connected: {
      text: 'Committee activity and constitutional verdicts. When a ruling touches your delegation chain, I will surface it.',
    },
  },
  treasury: {
    first_visit: {
      text: 'This is the common wealth of Cardano \u2014 billions of ADA held in trust for the ecosystem. Every withdrawal requires community consent. The question worth asking is not how much remains, but whether what has been spent has delivered anything worth the cost. The numbers are below. Decide for yourself.',
    },
    exploring: {
      text: '"Wealth consists not in having great possessions, but in having few wants." Still \u2014 this treasury is yours. Connect your wallet and I will show you exactly how spending decisions touch your stake.',
      cta: { label: 'Make it concrete', href: '/match' },
    },
    quiz_completed: {
      text: 'Your values include views on how the treasury should be stewarded. Connect your wallet and I will tell you whether current allocations honor those views \u2014 or betray them.',
      cta: { label: 'See treasury alignment', href: '/match' },
    },
    connected: {
      text: 'Treasury flows and runway projections. Where spending patterns conflict with your stated priorities, I will flag them.',
    },
  },
  health: {
    first_visit: {
      text: 'This is governance examined \u2014 not as we wish it were, but as it is. Participation rates. Power concentration. Deliberation quality. A democracy that refuses to measure itself has already begun to decay. These metrics tell you whether the system is healthy or merely still running.',
    },
    exploring: {
      text: 'You have explored the parts. This dashboard shows whether they compose a functioning democracy. Connect your wallet and I will tell you something harder: whether you are a participant in these numbers, or merely a bystander.',
      cta: { label: 'Find your place', href: '/match' },
    },
    quiz_completed: {
      text: '"We suffer more often in imagination than in reality." The health metrics here are real. Connect your wallet and I will show you how your participation \u2014 or your absence \u2014 moves these scores.',
      cta: { label: 'See your contribution', href: '/match' },
    },
    connected: {
      text: 'System vitals at a glance. When a governance metric shifts meaningfully between epochs, you will hear it from me first.',
    },
  },
};

// ---------------------------------------------------------------------------
// Seneca tooltip text
// ---------------------------------------------------------------------------

const SENECA_TOOLTIP =
  'Inspired by Seneca the Younger (c.\u00A04\u00A0BC\u2013AD\u00A065) \u2014 Stoic philosopher, statesman, and advisor whose letters on wisdom and governance remain influential two millennia later.';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompassGuide({
  page,
  briefing,
  proposalCount: _proposalCount,
  drepCount: _drepCount,
  poolCount: _poolCount,
}: CompassGuideProps) {
  const [progression, setProgression] = useState<CompassProgression>('first_visit');
  const [mounted, setMounted] = useState(false);
  const discovery = useDiscoveryHub();

  useEffect(() => {
    trackCompassPageView(page);
    const state: CompassState = getCompassState();
    setProgression(getCompassProgression(state));
    setMounted(true);
  }, [page]);

  if (!mounted) return null;

  const seneca = SENECA_NARRATIVES[page][progression];
  const narrative = briefing?.narrative ?? seneca.text;
  const headline = briefing?.headline ?? null;
  const cta = seneca.cta;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 sm:p-6 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <ScrollText className="h-3.5 w-3.5 text-primary" />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-help">
                Seneca
                <Info className="h-3 w-3 text-muted-foreground/40" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-[260px]">
              {SENECA_TOOLTIP}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Headline (only when briefing provides one) */}
      {headline && <p className="text-base font-semibold leading-snug">{headline}</p>}

      {/* Main narrative — Seneca's voice */}
      <p className="text-sm text-muted-foreground leading-relaxed italic">{narrative}</p>

      {/* Contextual CTA — unique per page */}
      {cta && (
        <Link
          href={cta.href}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium text-primary',
            'hover:text-primary/80 transition-colors',
          )}
        >
          {cta.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}

      {/* AI attribution (only when briefing is provided) */}
      {briefing && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
          <Sparkles className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/40">
            AI-generated briefing — updates with each epoch
          </span>
        </div>
      )}

      {/* Ask Seneca link */}
      {discovery && (
        <button
          onClick={() => discovery.openHub()}
          className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors"
        >
          <ScrollText className="h-3 w-3" />
          Ask Seneca
        </button>
      )}
    </motion.div>
  );
}
