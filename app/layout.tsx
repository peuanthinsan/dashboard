import './globals.css';

import { GeistSans } from 'geist/font/sans';

const title = 'SongdeeGPS Dashboard';
const description =
  'SongdeeGPS Dashboard for monitoring and managing alert data.';

export const metadata = {
  title,
  description,
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title,
    description,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  metadataBase: new URL('https://dashboard.songdeegps.com'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://docs.google.com" />
        <link rel="dns-prefetch" href="https://docs.google.com" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme');
              if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className={GeistSans.variable}>
        {children}
      </body>
    </html>
  );
}
