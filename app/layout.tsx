import './globals.css';

import { GeistSans } from 'geist/font/sans';
import { LanguageProvider } from './i18n';
import LanguageToggle from './theme/LanguageToggle';
import ThemeToggle from './theme/ThemeToggle';

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
    <html lang="en" suppressHydrationWarning>
      <body className={GeistSans.variable}>
        <LanguageProvider>
          <div
            id="theme-controls"
            className="fixed right-4 top-4 z-50 flex flex-row-reverse items-center gap-2"
          >
            <ThemeToggle />
            <LanguageToggle />
          </div>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
