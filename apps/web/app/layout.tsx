import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ProperData — Property intelligence, properly verified',
  description:
    'AI-powered Irish property intelligence built entirely on verified public data. Cross-references PPR, RTB, SEAI BER, OPW flood maps, planning data, and 15+ grant schemes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
