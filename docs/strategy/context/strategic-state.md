# Strategic State — Governada

Last updated: 2026-03-10
Updated by: Strategy session (initial creation)

---

## Current Phase Focus

**Phase 1: Workspace Recomposition** — ~90% complete.

Remaining:

- `/you/inbox` stub (notifications/alerts hub)
- Delegation page: detailed breakdown by action type

Next planned: Phase 2 (Citizen Experience Polish) — not yet scoped.

## Active Bets

1. **Hub-first architecture** — Persona-adaptive Hub replaces monolithic dashboard. Bet: users want a starting point, not a spreadsheet. Evidence: Hub card system shipped (Phase 0 MLE), coverage card wired.
2. **Intelligence over data** — Scores, narratives, and verdicts instead of raw numbers. Bet: citizens want conclusions, not charts. Evidence: GHI hero, score rings, narrative generation.
3. **Restraint as craft** — Fewer, better surfaces. Zero-sum information budget. Bet: removing features can improve the product. Evidence: V3 UX philosophy pivot, page-level JTBD constraints.

## Open Questions

1. **When do we launch publicly?** Phase 1 nearly complete, but citizen experience still rough in spots. What's the minimum bar?
2. **Monetization timing** — Vision says Phase 8, but early signals (API interest, DRep premium features) suggest we could test earlier. When?
3. **SPO engagement** — SPOs are our distribution channel but their experience is the least developed. When do we invest here?
4. **Mobile readiness** — Design principles say "mobile is primary" but we haven't audited mobile experience. How far behind are we?

## Recent Decisions

| Date       | Decision                                       | Rationale                                                           | Ref                   |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------- | --------------------- |
| 2026-03-10 | Consolidated audit suite from 11 to 6 commands | Reduce overlap, clearer ownership, persona-first auditing           | V3.0 vision update    |
| 2026-03-09 | V3.0 UX philosophy: "Restraint as Craft"       | Audit system was biased toward additive changes, producing clutter  | `vision-changelog.md` |
| 2026-03-09 | Page-level JTBD constraints                    | Every page gets ONE job in <8 words, information budget is zero-sum | `ux-constraints.md`   |
| 2026-03-08 | Hub card system for persona adaptation         | Cards compose per persona instead of one-size-fits-all dashboard    | Phase 0 MLE           |

## Audit Score History

Track scores across audits to measure progress over time.

| Date | Audit Type                          | Persona | Score | Notes                                                       |
| ---- | ----------------------------------- | ------- | ----- | ----------------------------------------------------------- |
| —    | No audits run yet against V3 rubric | —       | —     | Run `/audit-experience citizen-anonymous` as first baseline |

## Strategic Debt

Things we've deferred that need revisiting:

1. **E2E testing** — Playwright exists but no journey tests. Risk: regression in shipped flows.
2. **Mobile audit** — No systematic mobile review. "Mobile is primary" principle is aspirational.
3. **Analytics instrumentation** — PostHog events exist but coverage is patchy. Can't measure what we don't track.
4. **SEO** — No systematic SEO work. Governance content is highly searchable but we're not optimized.

## Competitive Watch

Last landscape update: 2026-03-09 (see `competitive-landscape.md`)

Key signals to watch:

- GovTool feature additions (direct competitor backed by Intersect)
- Tally expanding to non-EVM chains
- New CIPs affecting governance tooling
- Cardano governance process changes (Conway era evolution)

---

_This file is updated after every `/strategy` session. It's the first thing the next session reads._
