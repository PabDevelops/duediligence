import { timingSafeEqual } from 'crypto';
import { supabase } from '../../../../lib/supabase';

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

function isAuthorized(request) {
  const secret = process.env.WIDGET_ADMIN_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('x-widget-secret') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function listAllUsers() {
  const perPage = 1000;
  let page = 1;
  let all = [];
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all = all.concat(data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return all;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const users = await listAllUsers();
    const now = Date.now();
    const active = users.filter((u) => {
      if (!u.last_sign_in_at) return false;
      return now - new Date(u.last_sign_in_at).getTime() <= ACTIVE_WINDOW_MS;
    }).length;

    return Response.json({
      total: users.length,
      active,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'internal_error' }, { status: 500 });
  }
}
