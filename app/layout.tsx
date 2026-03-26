import './globals.css';

import { GeistSans } from 'geist/font/sans';

import { getDashboardLang } from 'app/dashboard/i18n';
import { getSiteCopy } from 'app/site-i18n-copy';

const title = 'SongdeeGPS Dashboard';
const description =
  'SongdeeGPS Dashboard for monitoring and managing alert data.';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getDashboardLang();
  const copy = getSiteCopy(lang);
  const htmlLang = lang === 'th' ? 'th' : 'en';

  return (
    <html lang={htmlLang} suppressHydrationWarning>
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
        <a href="#main-content" className="skip-to-content">
          {copy.skipToMain}
        </a>
        {children}
      </body>
    </html>
  );
}
