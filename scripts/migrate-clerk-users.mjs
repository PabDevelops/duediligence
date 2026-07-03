// One-off script: recreates Clerk users in Supabase Auth and remaps their
// user_id across app tables. Run with: node scripts/migrate-clerk-users.mjs
//
// Edit USERS below with { clerkId, email } pairs pulled from the Clerk dashboard,
// then run against a single test user first before running the full list.
import { createClient } from '@supabase/supabase-js';

const USERS = [
  { clerkId: 'user_3Fy4Fms8dUrBIZ9JSrYXRPDHOTI', email: 'angad.aujla@icloud.com' },
  { clerkId: 'user_3FZsxem2r3aAHfaKFzoP7kDGrp4', email: 'divinefavourraymond111@gmail.com' },
  { clerkId: 'user_3FJfisUPgQ7aRE3iFOXznmQa6UR', email: 'iamjoshua1222@gmail.com' },
  { clerkId: 'user_3EztM6ri9zeMQc2h2xFrA2Mf0bp', email: 'raaaaaaat77@gmail.com' },
  { clerkId: 'user_3Erl09zaGhAdNyxG93hSvaCm6Jd', email: 'noarceo@gmail.com' },
  { clerkId: 'user_3ErI3Zy0Oh5toCEeUBMsulh1223', email: 'ericasanchez0618@gmail.com' },
  { clerkId: 'user_3ErECIZYN80SvAbih9z5f95KPIP', email: 'japdadap@gmail.com' },
  { clerkId: 'user_3ErDH9fUpGmm20icUaYMHyVYDvs', email: 'anuja45v@gmail.com' },
  { clerkId: 'user_3EpEymsKFMSUeQeuEnD832WRLjY', email: 'adorehandcrafted@gmail.com' },
  { clerkId: 'user_3EmwqC1Ggl0F2s8hX6ZdPiYew1Z', email: 'prodriguezrial@gmail.com' },
  { clerkId: 'user_3EmwT8Q4EV3r1iqNWXWzv4PbKPz', email: 'media@traqcker.com' },
];

// Lifetime Pro accounts — after migration their subscription status is forced
// to 'active' regardless of what (if anything) existed before, since they
// don't renew through Stripe.
const LIFETIME_PRO_EMAILS = ['prodriguezrial@gmail.com', 'media@traqcker.com'];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TABLES = ['subscriptions', 'user_achievements', 'votes', 'watchlists', 'usage_tracking'];

async function findExistingUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return data.users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function migrateUser({ clerkId, email }) {
  const existing = await findExistingUserByEmail(email);
  let newId;
  let isNew = false;

  if (existing) {
    newId = existing.id;
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) throw new Error(`createUser(${email}): ${createError.message}`);
    newId = created.user.id;
    isNew = true;
  }

  for (const table of TABLES) {
    const { error } = await supabase.from(table).update({ user_id: newId }).eq('user_id', clerkId);
    if (error) throw new Error(`remap ${table} for ${email}: ${error.message}`);
  }

  if (LIFETIME_PRO_EMAILS.includes(email)) {
    const { error } = await supabase.from('subscriptions').upsert({
      user_id: newId,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw new Error(`force lifetime pro for ${email}: ${error.message}`);
  }

  // Only new (password-less) accounts need a "set your password" email —
  // existing accounts (e.g. already signed in via Google) already have access.
  if (isNew) {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/auth/callback`,
    });
    if (resetError) throw new Error(`resetPasswordForEmail(${email}): ${resetError.message}`);
  }

  console.log(`✓ ${email}: ${clerkId} -> ${newId} ${isNew ? '(created, reset email sent)' : '(reused existing account)'}`);
}

const usersToRun = process.env.TEST_ONLY ? USERS.slice(0, 1) : USERS;
for (const u of usersToRun) {
  await migrateUser(u);
}
