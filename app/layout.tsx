import './globals.css';

import { GeistSans } from 'geist/font/sans';
import ThemeToggle from './theme-toggle';

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
  const themeScript = `
    (() => {
      const storedTheme = window.localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : prefersDark
          ? 'dark'
          : 'light';
      document.documentElement.dataset.theme = theme;
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <div className="pointer-events-none fixed right-4 top-4 z-50">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
