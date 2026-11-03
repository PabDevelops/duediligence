import { Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { NEW_COLORS as C } from '../components/new/theme';

// Self-hosted via next/font instead of a <link> to fonts.googleapis.com (what the Design
// canvas mockup used) — same typeface, no extra render-blocking request, no layout shift.
// Applied here so it covers every page in this group without each one re-declaring it.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

// Privacy/Terms are only linked from the marketing pages' own footer — once a user is signed
// in and never visits those again, there was no way to reach them from inside the app at all.
// A minimal line here (not the full marketing Footer, which would be too heavy repeated under
// every dashboard page) keeps them reachable from everywhere in the group.
function AppLegalFooter() {
  const linkStyle = { color: C.text3, textDecoration: 'none' };
  return (
    <div style={{ textAlign: 'center', padding: '28px 24px 40px', fontSize: '11px', color: C.text3, background: C.bg }}>
      © {new Date().getFullYear()} Bulltrace · <Link href="/privacy" style={linkStyle}>Privacidad</Link> · <Link href="/terms" style={linkStyle}>Términos de uso</Link>
    </div>
  );
}

export default function NewLayout({ children }) {
  return (
    <div className={plusJakartaSans.className}>
      {children}
      <AppLegalFooter />
    </div>
  );
}
