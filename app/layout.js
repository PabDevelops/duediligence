import "./globals.css";

export const metadata = {
  title: "Traqcker — Fundamental Stock Analysis",
  description: "Deep fundamental analysis for serious investors. SEC filings, proprietary scoring, Graham DCF.",
  icons: { icon: '/favicon.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}