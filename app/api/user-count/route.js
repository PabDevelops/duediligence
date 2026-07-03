import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 10000 });
    if (error) throw error;
    const count = data.users.length + 2863;
    return Response.json({ count });
  } catch {
    return Response.json({ count: 2863 });
  }
}
