'use client';

import { cn } from '@/lib/utils';

interface GovernadaLogoProps {
  className?: string;
  size?: number;
  /** Show just the icon mark (no text) */
  iconOnly?: boolean;
}

/**
 * Governada logo — G lettermark formed by connected network nodes
 * on a globe-like circular arc.
 *
 * Coordinates extracted from original image via pixel analysis.
 * Arc: center ≈ (51.7, 51.8), radius ≈ 22.
 * Crossbar is nearly perfectly horizontal.
 */
export function GovernadaLogo({
  className,
  size = 32,
  iconOnly: _iconOnly = true,
}: GovernadaLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-label="Governada logo"
      role="img"
    >
      {/* Main G arc — from upper-right to center-right, traced from original */}
      <path
        d="M 67 35 A 22 22 0 1 0 73 51"
        fill="none"
        stroke="#4EEAC6"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* G crossbar — nearly perfectly horizontal */}
      <line
        x1="73"
        y1="51"
        x2="51"
        y2="51"
        stroke="#4EEAC6"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Outer arc nodes — positions from pixel analysis */}
      <circle cx="67" cy="35" r="4.5" fill="#4EEAC6" />
      <circle cx="51" cy="29" r="4" fill="#4EEAC6" />
      <circle cx="39" cy="41" r="3.5" fill="#4EEAC6" />
      <circle cx="29" cy="53" r="4.5" fill="#4EEAC6" />
      <circle cx="39" cy="62" r="3.5" fill="#4EEAC6" />
      <circle cx="50" cy="73" r="4.5" fill="#4EEAC6" />
      <circle cx="66" cy="70" r="4" fill="#4EEAC6" />
      <circle cx="73" cy="51" r="4.5" fill="#4EEAC6" />

      {/* Internal network nodes */}
      <circle cx="61" cy="61" r="4" fill="#4EEAC6" />
      <circle cx="51" cy="51" r="4" fill="#4EEAC6" />

      {/* Internal connection lines */}
      <line
        x1="51"
        y1="29"
        x2="61"
        y2="61"
        stroke="#4EEAC6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="61"
        y1="61"
        x2="73"
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
  );
}
