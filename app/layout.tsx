import type { Metadata, Viewport } from 'next';
import PushRegistration from '../components/PushRegistration';
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
        {children}
      </body>
    </html>
  );
}
