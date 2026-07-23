import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'StockPilot — Multi-Warehouse Inventory Management',
    template: '%s | StockPilot',
  },
  description:
    'A control tower for physical goods — showing exactly what is where, alerting when stock runs low, and orchestrating safe, atomic transfers between locations.',
  keywords: ['inventory management', 'warehouse', 'stock control', 'retail', 'supply chain'],
  authors: [{ name: 'Urban Sole' }],
  robots: 'index, follow',
  openGraph: {
    title: 'StockPilot — Multi-Warehouse Inventory Management',
    description:
      'A control tower for physical goods — showing exactly what is where, alerting when stock runs low, and orchestrating safe, atomic transfers between locations.',
    type: 'website',
    siteName: 'StockPilot',
    images: [{ url: '/favicon.ico', width: 32, height: 32 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StockPilot — Multi-Warehouse Inventory Management',
    description:
      'A control tower for physical goods — showing exactly what is where, alerting when stock runs low, and orchestrating safe, atomic transfers between locations.',
    images: [{ url: '/favicon.ico', width: 32, height: 32 }],
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
