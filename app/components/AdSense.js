const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// A plain <script> tag, NOT next/script's <Script> component. next/script's
// "afterInteractive" strategy only emits a <link rel="preload"> plus an RSC
// payload in the initial HTML — the real <script src="..."> element only gets
// created client-side after hydration. Google's AdSense site-verification
// crawler doesn't execute JS, so it never saw the tag with that approach.
// A native <script> renders literally in the SSR'd HTML, matching exactly
// what Google's own snippet instructions expect.
export default function AdSense() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}
