import { createClient } from './supabase/server';
import { getGuestId } from './guestId';

export async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// Unified visitor identity for anonymous-access features: a registered user
// resolves to their Supabase user id, a guest resolves to the tq_gid cookie
// minted in middleware.js. Used to scope rate limits and usage caps.
export async function getVisitor() {
  const userId = await getUserId();
  if (userId) return { type: 'registered', id: userId };
  const guestId = await getGuestId();
  return { type: 'anonymous', id: guestId };
}
