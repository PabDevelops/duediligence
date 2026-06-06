import "./globals.css";

export const metadata = {
  title: "Traqcker — Stock Analysis",
  description: "Deep fundamental analysis for serious investors.",
  icons: { icon: '/favicon.png' },
  viewport: 'width=device-width, initial-scale=1',
};



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}