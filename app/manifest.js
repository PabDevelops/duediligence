// Next.js's manifest file convention — automatically served at /manifest.webmanifest and
// linked from every page's <head>, no manual <link rel="manifest"> needed. This is what makes
// the site installable (Chrome/Android's "Add to Home screen"/"Install app" prompt, and a
// proper standalone window instead of opening inside the browser chrome) — icons alone
// (favicon/apple-touch-icon, already set in app/layout.js) only cover the bookmark-icon case,
// not real installability.
export default function manifest() {
  return {
    name: 'Bulltrace — Análisis de inversión',
    short_name: 'Bulltrace',
    description: 'Análisis fundamental de empresas y fondos, pensado para aprender mientras investigas.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#FAF7F0',
    theme_color: '#1C1B18',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
