export async function GET() {
  try {
    const res = await fetch('https://api.clerk.com/v1/users/count', {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      next: { revalidate: 60 },
    });
    const data = await res.json();
    const count = (data.total_count || 0) + 2863;
    return Response.json({ count });
  } catch {
    return Response.json({ count: 2863 });
  }
}
