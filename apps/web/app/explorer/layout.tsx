import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Property Explorer — ProperData',
  description: 'Explore Irish property sales data from the Property Price Register.',
};

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return children;
}
