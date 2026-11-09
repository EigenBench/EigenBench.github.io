import { pageMetadata } from '@/lib/metadata';
import './globals.css';
import './research.css';
import './bands.css';
import './pages.css';
import './hub.css';
import './arena.css';
import './results-pages.css';
import './home-insights.css';
import './eigenbench.css';
import './themes.css';
import './page-backgrounds.css';
import './controls.css';
import './value-logos.css';
import './evaluation-theme.css';
import './saved-runs.css';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ArenaShell } from '@/components/ArenaShell';

const spaceGrotesk = localFont({
  src: '../../public/fonts/0c89a48fa5027cee-s.p.0rd3rjvnnhw7n.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-space-grotesk',
});

const jetbrainsMono = localFont({
  src: '../../public/fonts/051742360c26797e-s.p.0f97p8c3305p~.woff2',
  weight: '400 500',
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://eigenbench.github.io'),
  ...pageMetadata('EigenBench — Find your model match', 'Find the model closest to your choices, explore saved evaluations, and run your own behavioral evaluations.'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/laisr-icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-touch-icon.png',
  },

};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Hydrate theme before paint to avoid flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('valuearena-theme')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}",
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <ArenaShell>{children}</ArenaShell>
      </body>
    </html>
  );
}
