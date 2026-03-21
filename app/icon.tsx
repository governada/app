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
      <svg viewBox="22 22 58 58" width="26" height="26">
        <path
          d="M 67 35 A 22 22 0 1 0 73 51"
          fill="none"
          stroke="#4EEAC6"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="73"
          y1="51"
          x2="51"
          y2="51"
          stroke="#4EEAC6"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="67" cy="35" r="4.5" fill="#4EEAC6" />
        <circle cx="51" cy="29" r="4" fill="#4EEAC6" />
        <circle cx="39" cy="41" r="3.5" fill="#4EEAC6" />
        <circle cx="29" cy="53" r="4.5" fill="#4EEAC6" />
        <circle cx="39" cy="62" r="3.5" fill="#4EEAC6" />
        <circle cx="50" cy="73" r="4.5" fill="#4EEAC6" />
        <circle cx="66" cy="70" r="4" fill="#4EEAC6" />
        <circle cx="73" cy="51" r="4.5" fill="#4EEAC6" />
        <circle cx="61" cy="61" r="4" fill="#4EEAC6" />
        <circle cx="51" cy="51" r="4" fill="#4EEAC6" />
        <line
          x1="67"
          y1="35"
          x2="61"
          y2="61"
          stroke="#4EEAC6"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="61"
          y1="61"
          x2="51"
          y2="51"
          stroke="#4EEAC6"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="61"
          y1="61"
          x2="66"
          y2="70"
          stroke="#4EEAC6"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { ...size },
  );
}
