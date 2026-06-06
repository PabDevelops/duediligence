import "./globals.css";

export const metadata = {
  title: "Traqcker — Fundamental Stock Analysis",
  description: "Deep fundamental analysis for serious investors. SEC filings, proprietary scoring, Graham DCF.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}