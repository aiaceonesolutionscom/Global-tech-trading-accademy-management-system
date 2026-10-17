import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Global Trading — Student, Course & Fee Management System',
  description:
    'Comprehensive Student, Course, Trainer, Billing and Payment Management System for Global Trading Academy',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased bg-slate-50 text-slate-900 font-sans min-h-screen selection:bg-[#0052CC] selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
