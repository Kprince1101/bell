import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Bell',
  description: 'All your calendars in one place, and you never miss a meeting.',
};

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: Readonly<RootLayoutProps>) => (
  <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
    <body className="flex min-h-full flex-col">{children}</body>
  </html>
);

export default RootLayout;
