import './globals.css';

import { GeistSans } from 'geist/font/sans';

let title = 'SongdeeGPS Dashboard';
let description =
  'SongdeeGPS Dashboard for monitoring and managing alert data.';

export const metadata = {
  title,
  description,
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  metadataBase: new URL('https://songdeegps-dashboard.vercel.app'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.variable}>{children}</body>
    </html>
  );
}
