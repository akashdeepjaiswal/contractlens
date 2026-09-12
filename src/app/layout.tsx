import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'ContractLens — Contract Review for Non-Lawyers',
  description:
    'Upload vendor contracts and instantly extract, understand, and query every clause. Built for founders who review contracts without a lawyer.',
  keywords: ['contract review', 'legal tech', 'clause extraction', 'vendor contracts'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
