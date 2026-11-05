import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';
import { validateBasketName } from '../../../../lib/watchlistBaskets';

export const dynamic = 'force-dynamic';

function databaseError(error) {
  if (error.code === '23505') {
    return Response.json({ error: 'Ya existe una cesta con ese nombre.' }, { status: 409 });
  }
  if (error.code === 'P0002') {
    return Response.json({ error: 'Esa cesta ya no existe. Recarga la página.' }, { status: 404 });
  }
  console.error('watchlist baskets:', error);
  return Response.json({ error: 'No se pudieron guardar o cargar las cestas. Inténtalo de nuevo.' }, { status: 503 });
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase.from('watchlist_baskets')
    .select('name').eq('user_id', userId).order('name');
  if (error) return databaseError(error);
  return Response.json({ baskets: data.map(row => row.name) });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const errorMessage = validateBasketName(body?.name);
  if (errorMessage) return Response.json({ error: errorMessage }, { status: 400 });

  const name = body.name.trim();
  // Also reject a legacy category created after the migration's backfill.
  const { data: existing, error: readError } = await supabase.from('watchlists')
    .select('ticker').eq('user_id', userId).eq('pie', name).limit(1);
  if (readError) return databaseError(readError);
  if (existing.length) return databaseError({ code: '23505' });

  const { error } = await supabase.from('watchlist_baskets').insert({ user_id: userId, name });
  if (error) return databaseError(error);
  return Response.json({ name }, { status: 201 });
}

async function changeBasket(request, deleting) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  // Do not trim the source: old category names must still match exactly.
  if (typeof body?.name !== 'string' || !body.name) {
    return Response.json({ error: 'Nombre de cesta requerido.' }, { status: 400 });
  }
  if (!deleting) {
    const errorMessage = validateBasketName(body.newName);
    if (errorMessage) return Response.json({ error: errorMessage }, { status: 400 });
  }

  // One transaction updates the name registry and assignments. Deleting a basket
  // only clears its pie labels; it never deletes watchlist rows.
  const { error } = await supabase.rpc('change_watchlist_basket', {
    p_user_id: userId,
    p_name: body.name,
    p_new_name: deleting ? null : body.newName.trim(),
  });
  if (error) return databaseError(error);
  return Response.json({ success: true });
}

export async function PATCH(request) {
  return changeBasket(request, false);
}

export async function DELETE(request) {
  return changeBasket(request, true);
}
