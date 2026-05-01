import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Property Analyser — ProperData',
  description:
    'Get AI-powered property intelligence: comparable valuations, grant eligibility, radon risk, solar potential, walkability, and more.',
};

export default function AnalyseLayout({ children }: { children: ReactNode }) {
  return children;
}
