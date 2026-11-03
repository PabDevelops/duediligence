import { checkIsPro } from '../../../lib/isPro';

export async function GET() {
  const isPro = await checkIsPro();
  return Response.json({ isPro, needsTrial: false });
}
