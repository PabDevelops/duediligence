// One-off script: recreates Clerk users in Supabase Auth and remaps their
// user_id across app tables. Run with: node scripts/migrate-clerk-users.mjs
//
// Edit USERS below with { clerkId, email } pairs pulled from the Clerk dashboard,
// then run against a single test user first before running the full list.
import { createClient } from '@supabase/supabase-js';

const USERS = [
  // { clerkId: 'user_xxx', email: 'someone@example.com' },
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TABLES = ['subscriptions', 'user_achievements', 'votes', 'watchlists', 'usage_tracking'];

async function migrateUser({ clerkId, email }) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError) throw new Error(`createUser(${email}): ${createError.message}`);

  const newId = created.user.id;

  for (const table of TABLES) {
    const { error } = await supabase.from(table).update({ user_id: newId }).eq('user_id', clerkId);
    if (error) throw new Error(`remap ${table} for ${email}: ${error.message}`);
  }

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/callback`,
  });
  if (resetError) throw new Error(`resetPasswordForEmail(${email}): ${resetError.message}`);

  console.log(`✓ ${email}: ${clerkId} -> ${newId}`);
}

for (const u of USERS) {
  await migrateUser(u);
}
