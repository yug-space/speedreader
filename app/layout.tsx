import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Speed Reader',
  description: 'Read faster with RSVP speed reading',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
