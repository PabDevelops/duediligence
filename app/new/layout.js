import { Plus_Jakarta_Sans } from 'next/font/google';

// Self-hosted via next/font instead of a <link> to fonts.googleapis.com (what the Design
// canvas mockup used) — same typeface, no extra render-blocking request, no layout shift.
// Applied here so it covers every /new/* page without each one re-declaring it.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

export default function NewLayout({ children }) {
  return <div className={plusJakartaSans.className}>{children}</div>;
}
