import { supabase } from '../../../lib/supabase';

export async function GET() {
  try {
    const { data: rows } = await supabase
      .from('stock_cache')
      .select('ticker, data')
      .not('data->currentPrice', 'is', null)
      .not('data->priceChangePct', 'is', null);

    if (!rows?.length) return Response.json({ gainers: [], losers: [], topRoic: [], topFcfYield: [], topRevGrowth: [], topScore: [] });

    const stocks = rows.map(r => ({
      ticker: r.ticker,
      name: r.data.name,
      sector: r.data.sector,
      currentPrice: r.data.currentPrice,
      priceChangePct: r.data.priceChangePct,
      roic: r.data.roic,
      fcfYield: r.data.fcfYield,
      revGrowth: r.data.revGrowth,
      grossMargin: r.data.grossMargin,
      opMargin: r.data.opMargin,
      debtToEquity: r.data.debtToEquity,
      pfcf: r.data.pfcf,
      marketCap: r.data.marketCap,
    }));

    const calcScore = (d) => {
      if (!d) return null;
      const sec = (d.sector || '').toLowerCase();
      const isTech = sec.includes('tech') || sec.includes('software') || sec.includes('semi');
      const isPharma = sec.includes('pharma') || sec.includes('biotech') || sec.includes('health');
      const isFinancial = sec.includes('bank') || sec.includes('insurance') || sec.includes('financial');
      const roicT = isTech ? 0.25 : isPharma ? 0.20 : 0.15;
      const gmT = isTech ? 0.65 : isPharma ? 0.65 : isFinancial ? 0.30 : 0.35;
      const omT = isTech ? 0.20 : isPharma ? 0.20 : 0.15;
      const roicS = d.roic == null ? 2.5 : d.roic/100 >= roicT*2 ? 5 : d.roic/100 >= roicT*1.5 ? 4.5 : d.roic/100 >= roicT ? 4 : d.roic/100 >= roicT*0.7 ? 3 : 2;
      const gmS = d.grossMargin == null ? 2.5 : d.grossMargin/100 >= gmT*1.4 ? 5 : d.grossMargin/100 >= gmT*1.15 ? 4.5 : d.grossMargin/100 >= gmT ? 4 : d.grossMargin/100 >= gmT*0.75 ? 3 : 2;
      const omS = d.opMargin == null ? 2.5 : d.opMargin/100 >= omT*2 ? 5 : d.opMargin/100 >= omT*1.5 ? 4.5 : d.opMargin/100 >= omT ? 4 : d.opMargin/100 >= omT*0.65 ? 3 : 2;
      const deS = d.debtToEquity == null ? 2.5 : d.debtToEquity < 0.3 ? 5 : d.debtToEquity < 0.7 ? 4.5 : d.debtToEquity < 1.2 ? 4 : d.debtToEquity < 2 ? 3 : 2;
      const cbs = roicS*0.4 + gmS*0.25 + omS*0.25 + deS*0.1;
      const pfcfS = d.pfcf == null || d.pfcf <= 0 ? 1 : d.pfcf < 12 ? 5 : d.pfcf < 18 ? 4.5 : d.pfcf < 25 ? 4 : d.pfcf < 35 ? 3 : 2;
      const fcfYS = d.fcfYield == null ? 1 : d.fcfYield > 8 ? 5 : d.fcfYield > 5 ? 4.5 : d.fcfYield > 3 ? 4 : d.fcfYield > 1.5 ? 3 : 2;
      const oppo = pfcfS*0.55 + fcfYS*0.45;
      const revGS = d.revGrowth == null ? 2.5 : d.revGrowth > 25 ? 5 : d.revGrowth > 15 ? 4.5 : d.revGrowth > 8 ? 4 : d.revGrowth > 3 ? 3 : 2;
      const gqs = Math.min(5, revGS*0.6 + 3*0.4);
      return +((cbs*0.45 + oppo*0.30 + gqs*0.25)).toFixed(1);
    };

    const withScore = stocks.map(s => ({ ...s, score: calcScore(s) }));
    const sorted = (arr, key, dir = 'desc') => [...arr].filter(s => s[key] != null).sort((a, b) => dir === 'desc' ? b[key] - a[key] : a[key] - b[key]);

    return Response.json({
      gainers: sorted(withScore, 'priceChangePct').slice(0, 20),
      losers: sorted(withScore, 'priceChangePct', 'asc').slice(0, 20),
      topRoic: sorted(withScore, 'roic').slice(0, 10),
      topFcfYield: sorted(withScore, 'fcfYield').slice(0, 10),
      topRevGrowth: sorted(withScore, 'revGrowth').slice(0, 10),
      topScore: sorted(withScore, 'score').slice(0, 10),
    });
  } catch (e) {
    console.error(e);
    return Response.json({ gainers: [], losers: [], topRoic: [], topFcfYield: [], topRevGrowth: [], topScore: [] });
  }
}