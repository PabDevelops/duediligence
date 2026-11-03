'use client';
import { NEW_COLORS as C } from './theme';

// Shared avatar: the user's own uploaded photo (user_metadata.avatar_url, set from the
// Profile page) when they have one, otherwise our bull mark on lime — never a blank circle
// or a bare initial, so "no photo set" still reads as branded, not broken.
export default function Avatar({ user, size = 36 }) {
  const avatarUrl = user?.user_metadata?.avatar_url;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }}
      />
    );
  }

  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: '50%', background: C.lime, border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: Math.round(size * 0.22),
      boxSizing: 'border-box', flexShrink: 0,
    }}>
      <img src="/bulltrace-logos/bull-icon-black.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}
