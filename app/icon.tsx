import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0b14',
        borderRadius: 6,
      }}
    >
      <svg viewBox="0 0 100 100" width="26" height="26">
        <defs>
          <linearGradient id="g" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#5CECC8" />
            <stop offset="100%" stopColor="#3CC8A0" />
          </linearGradient>
        </defs>
        <path
          d="M 68 19 A 35 35 0 1 0 68 58"
          fill="none"
          stroke="url(#g)"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <line
          x1="68"
          y1="58"
          x2="50"
          y2="50"
          stroke="url(#g)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="68" cy="19" r="5" fill="url(#g)" />
        <circle cx="44" cy="7" r="4.5" fill="url(#g)" />
        <circle cx="20" cy="17" r="4" fill="url(#g)" />
        <circle cx="7" cy="38" r="5" fill="url(#g)" />
        <circle cx="10" cy="60" r="4" fill="url(#g)" />
        <circle cx="25" cy="76" r="4.5" fill="url(#g)" />
        <circle cx="50" cy="80" r="4" fill="url(#g)" />
        <circle cx="68" cy="58" r="5" fill="url(#g)" />
        <circle cx="50" cy="50" r="4.5" fill="url(#g)" />
        <circle cx="57" cy="33" r="3.5" fill="url(#g)" />
        <line
          x1="44"
          y1="7"
          x2="57"
          y2="33"
          stroke="url(#g)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="57"
          y1="33"
          x2="68"
          y2="58"
          stroke="url(#g)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="57"
          y1="33"
          x2="50"
          y2="50"
          stroke="url(#g)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { ...size },
  );
}
