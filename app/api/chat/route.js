import Anthropic from '@anthropic-ai/sdk';
import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DAILY_LIMIT = 3;

const SYSTEM_PROMPT = `You are Traq, Traqcker's research assistant. You answer questions about public companies using only the financial data provided to you in this conversation — never your own outside knowledge of recent events, news, or prices, since that data may be stale or wrong.

Rules:
- Ground every claim in the numbers given. If something isn't in the data, say you don't have that figure instead of guessing.
- No speculation about future stock price moves.
- Be concise and direct — this is a working tool, not a chat companion.
- If no stock data was provided, answer only general finance/investing questions the same way.
- Format your answers in markdown: use headers, **bold** for key terms/tickers, and bullet lists for breakdowns.`;

// Builds a grounding block from the user's holdings + their cached fundamentals — same
// stock_cache table every other widget reads, so no extra external API calls here.
async function buildPortfolioContext(userId) {
  const { data: holdings } = await supabase
    .from('portfolio_holdings')
    .select('ticker, shares, cost_basis, cost_basis_currency, pie')
    .eq('user_id', userId);

  if (!holdings || holdings.length === 0) return null;

  const tickers = [...new Set(holdings.map(h => h.ticker))];
  const { data: stocks } = await supabase.from('stock_cache').select('ticker, data').in('ticker', tickers);
  const byTicker = Object.fromEntries((stocks || []).map(s => [s.ticker, s.data || {}]));

  const positions = holdings.map(h => {
    const d = byTicker[h.ticker] || {};
    return {
      ticker: h.ticker,
      shares: h.shares,
      avgCost: h.cost_basis,
      costCurrency: h.cost_basis_currency,
      pie: h.pie,
      name: d.name ?? null,
      sector: d.sector ?? null,
      currentPrice: d.currentPrice ?? null,
      pe: d.pe ?? null,
      revGrowth: d.revGrowth ?? null,
      opMargin: d.opMargin ?? null,
      roic: d.roic ?? null,
      fcfYield: d.fcfYield ?? null,
      debtToEquity: d.debtToEquity ?? null,
    };
  });

  return `The user's current portfolio (${positions.length} position${positions.length === 1 ? '' : 's'}):\n` + JSON.stringify(positions);
}

async function getChatUsage(userId, today) {
  const { data } = await supabase
    .from('usage_tracking')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .eq('type', 'chat')
    .single();
  return data?.count || 0;
}

async function incrementChatUsage(userId, today, currentCount) {
  if (currentCount > 0) {
    await supabase
      .from('usage_tracking')
      .update({ count: currentCount + 1 })
      .eq('user_id', userId)
      .eq('date', today)
      .eq('type', 'chat');
  } else {
    await supabase
      .from('usage_tracking')
      .insert({ user_id: userId, date: today, count: 1, type: 'chat' });
  }
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  // Every account reaching this route is already Pro (the terminal itself is
  // Pro-gated), so the daily cap applies uniformly — no subscription bypass.
  const today = new Date().toISOString().slice(0, 10);
  const used = await getChatUsage(userId, today);

  if (used >= DAILY_LIMIT) {
    return Response.json({ error: 'limit_reached', limit: DAILY_LIMIT, remaining: 0 }, { status: 429 });
  }

  const { message, ticker, history, usePortfolio } = await request.json();
  if (!message) return Response.json({ error: 'message required' }, { status: 400 });

  let context = '';
  if (usePortfolio) {
    context = (await buildPortfolioContext(userId)) || "The user's portfolio is empty — they haven't added any holdings yet.";
  } else if (ticker) {
    const { data } = await supabase.from('stock_cache').select('data').eq('ticker', ticker.toUpperCase()).single();
    if (data?.data) {
      const d = data.data;
      context = `Data for ${ticker.toUpperCase()} (${d.name || ''}, ${d.sector || ''}):\n` + JSON.stringify({
        currentPrice: d.currentPrice, pe: d.pe, marketCap: d.marketCap,
        revGrowth: d.revGrowth, opMargin: d.opMargin, grossMargin: d.grossMargin,
        netMargin: d.netMargin, roe: d.roe, roic: d.roic, fcfYield: d.fcfYield,
        debtToEquity: d.debtToEquity, netDebt: d.netDebt, eps: d.eps,
      });
    }
  }

  const messages = [
    ...(history || []).slice(-8).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: context ? `${context}\n\nQuestion: ${message}` : message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages,
    });
    const text = response.content.find(b => b.type === 'text')?.text || '';
    // Only spend a daily use on a successful reply — a backend failure shouldn't cost the user their quota
    await incrementChatUsage(userId, today, used);
    return Response.json({ reply: text, remaining: DAILY_LIMIT - used - 1 });
  } catch (e) {
    console.error('chat error:', e);
    return Response.json({ error: 'Chat is unavailable right now.' }, { status: 500 });
  }
}
