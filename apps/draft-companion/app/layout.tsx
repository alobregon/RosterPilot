import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './dark-selects.css';

export const metadata: Metadata = {
  title: 'RosterPilot Draft Companion',
  description: 'Live fantasy football draft recommendations powered by your rankings.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
