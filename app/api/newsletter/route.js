import { supabase } from '../../../lib/supabase';
import { checkIsAdmin } from '../../../lib/isAdmin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  const { email, source } = await req.json();

  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'Enter a valid email' }, { status: 400 });
  }

  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email: email.toLowerCase().trim(), source: source || 'landing' }, { onConflict: 'email', ignoreDuplicates: true });

  if (error) return Response.json({ error: 'Something went wrong' }, { status: 500 });
  return Response.json({ success: true });
}

export async function GET() {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('email, source, created_at')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ subscribers: data || [], count: data?.length || 0 });
}
