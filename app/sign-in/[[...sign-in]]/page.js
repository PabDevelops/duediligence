import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Nunito, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: '500px', height: '400px', background: 'radial-gradient(ellipse, rgba(167,139,250,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '25%', width: '350px', height: '300px', background: 'radial-gradient(ellipse, rgba(96,165,250,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <SignIn />
    </div>
  );
}
