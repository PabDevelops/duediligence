export const dynamic='force-dynamic';

// Deliberately no auth, database or financial-loader imports. Crawlers and old
// clients cannot restart a universe scan through this retired endpoint.
export async function GET(){
 return Response.json({stocks:[],error:'El screener ya no está disponible.'},{status:410});
}