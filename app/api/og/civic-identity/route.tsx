import { ImageResponse } from 'next/og';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * OG image for the Civic Identity Ceremony share card.
 * Query params: drepName, matchPercentage, governancePower
 * Produces a 1200x630 image suitable for social sharing.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const drepName = searchParams.get('drepName') ?? 'Your DRep';
    const matchPercentage = searchParams.get('match') ?? '0';
    const governancePower = searchParams.get('power') ?? '0';

    // Ring colors matching GovernanceRings RING_COLORS
    const ringParticipation = '#38bebe'; // Compass Teal
    const ringDeliberation = '#d4a847'; // Wayfinder Amber
    const ringImpact = '#9b6fd9'; // Meridian Violet

    return new ImageResponse(
      <OGBackground glow={ringParticipation}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '60px 80px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Rings visualization (static SVG) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
            }}
          >
            <svg width="120" height="120" viewBox="0 0 120 120">
              {/* Participation ring (outer) — filled 20% */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={`${ringParticipation}20`}
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={ringParticipation}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${0.2 * 2 * Math.PI * 54} ${0.8 * 2 * Math.PI * 54}`}
                strokeDashoffset={2 * Math.PI * 54 * 0.25}
              />
              {/* Deliberation ring (middle) — empty */}
              <circle
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke={`${ringDeliberation}20`}
                strokeWidth="8"
              />
              {/* Impact ring (inner) — empty */}
              <circle
                cx="60"
                cy="60"
                r="30"
                fill="none"
                stroke={`${ringImpact}20`}
                strokeWidth="8"
              />
            </svg>
          </div>

          {/* Civic title */}
          <div
            style={{
              display: 'flex',
              fontSize: '56px',
              fontWeight: 700,
              color: OG.text,
              letterSpacing: '-0.02em',
            }}
          >
            Citizen
          </div>

          {/* DRep match info */}
          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              color: OG.textMuted,
              marginTop: '12px',
              gap: '8px',
            }}
          >
            <span>Represented by</span>
            <span style={{ color: OG.text, fontWeight: 600 }}>{drepName}</span>
            <span style={{ color: OG.textDim }}>&middot;</span>
            <span style={{ color: ringParticipation, fontWeight: 600 }}>
              {matchPercentage}% match
            </span>
          </div>

          {/* Governance Power */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: '28px',
              padding: '20px 40px',
              borderRadius: '16px',
              backgroundColor: OG.bgCard,
              border: `1px solid ${OG.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '14px',
                color: OG.textDim,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '4px',
              }}
            >
              Governance Power
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '36px',
                fontWeight: 700,
                color: OG.text,
              }}
            >
              <span style={{ color: ringParticipation, marginRight: '4px' }}>{'\u20B3'}</span>
              {governancePower}
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              display: 'flex',
              fontSize: '16px',
              color: OG.textDim,
              marginTop: '24px',
              fontStyle: 'italic',
            }}
          >
            Your voice in Cardano&apos;s future is now active.
          </div>

          <OGFooter left="Governada" right="governada.io" />
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Civic Identity Ceremony] Error:', error);
    return new ImageResponse(<OGFallback message="Citizen of Cardano" />, {
      width: 1200,
      height: 630,
    });
  }
}
