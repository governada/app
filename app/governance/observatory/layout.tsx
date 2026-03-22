import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Governance Observatory',
};

export default function ObservatoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
