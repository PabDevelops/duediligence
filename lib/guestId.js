import { cookies } from 'next/headers';

// Reads the anonymous visitor id minted by middleware.js (cookie `tq_gid`).
// Null only if middleware didn't run for this request (e.g. some non-route
// contexts) — callers should treat that as "no rate-limit identity available".
export async function getGuestId() {
  const store = await cookies();
  return store.get('tq_gid')?.value || null;
}
