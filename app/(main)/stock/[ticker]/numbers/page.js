import { redirect } from 'next/navigation';

export default async function StockNumbersPage({ params }) {
  const { ticker } = await params;
  redirect(`/stock/${encodeURIComponent(ticker.toUpperCase())}/analisis#estados-financieros`);
}
