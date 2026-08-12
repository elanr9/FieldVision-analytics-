import type { Metadata, Viewport } from 'next';
import PushRegistration from '../components/PushRegistration';
import StaleAppReload from '../components/StaleAppReload';
import './globals.css';

export const metadata: Metadata = {
  title: 'FieldVision Analytics',
  description: 'Internal analytics for FieldVision',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PushRegistration />
        <StaleAppReload />
        {children}
      </body>
    </html>
  );
}
