create table if not exists blog_posts (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  description text not null,
  date date not null default current_date,
  read_time text not null default '4 min read',
  tag text not null default 'Fundamentals',
  tickers text[] not null default '{}',
  sentiment text not null default 'neutral',
  author text not null default 'Traqcker Team',
  content jsonb not null default '[]',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists blog_posts_tickers_idx on blog_posts using gin (tickers);

insert into blog_posts (slug, title, description, date, read_time, tag, tickers, content, published) values
(
  'what-is-roic',
  'What is ROIC and why it matters more than P/E',
  'Return on Invested Capital tells you how efficiently a company turns money into profit. Here''s how to read it without a finance degree.',
  '2026-06-01',
  '4 min read',
  'Fundamentals',
  '{}',
  '[
    {"type":"p","text":"Most people learn to check the P/E ratio first. It''s simple — price divided by earnings — but it tells you almost nothing about whether a business is actually good. Return on Invested Capital (ROIC) does."},
    {"type":"h2","text":"What ROIC actually measures"},
    {"type":"p","text":"ROIC answers one question: for every dollar a company puts to work — in factories, inventory, R&D, acquisitions — how much profit does it generate? A company with $100M in invested capital that earns $20M in operating profit has a 20% ROIC. That''s excellent. A company earning $3M on the same $100M has a 3% ROIC, which barely beats putting the money in a savings account."},
    {"type":"p","text":"The formula is: ROIC = Net Operating Profit After Tax (NOPAT) / Invested Capital. Invested Capital is roughly total debt plus equity minus cash."},
    {"type":"h2","text":"Why it beats P/E as a quality signal"},
    {"type":"p","text":"P/E tells you what you''re paying for a dollar of current earnings. It says nothing about whether those earnings are durable, or whether the company can keep generating them without burning more capital. ROIC tells you about the engine, not the price tag."},
    {"type":"p","text":"A company can have a low P/E and still be a bad business — if its ROIC is shrinking, the \"cheap\" valuation may be justified. Inversely, a high-ROIC company often deserves a premium multiple because it compounds capital efficiently over time."},
    {"type":"h2","text":"What counts as a good ROIC"},
    {"type":"p","text":"Compare ROIC to the company''s cost of capital (WACC), usually somewhere around 7-10% for most US businesses. If ROIC consistently exceeds WACC by a wide margin, the company is creating real value with every dollar it reinvests. If ROIC is below WACC, growth is actually destroying value — the company would be better off returning cash to shareholders than reinvesting it."},
    {"type":"p","text":"As a rough guide: above 15% is strong, above 25% is exceptional (think Apple, Visa), and below 8% deserves scrutiny regardless of how fast revenue is growing."},
    {"type":"h2","text":"Where to find it"},
    {"type":"p","text":"Traqcker calculates ROIC automatically from SEC filings for any of the 8,000+ stocks we cover — no spreadsheet required. Search a ticker and it''s right there in the quality score breakdown."}
  ]'::jsonb,
  true
),
(
  'how-to-read-dcf-valuation',
  'How to read a DCF valuation (without the spreadsheet)',
  'A discounted cash flow model sounds intimidating. The core idea is simple: a business is worth the cash it will generate, discounted back to today.',
  '2026-06-05',
  '5 min read',
  'Valuation',
  '{}',
  '[
    {"type":"p","text":"Discounted Cash Flow (DCF) valuation has a reputation for being complicated — and the spreadsheets can be. But the underlying logic is something you already understand: a dollar today is worth more than a dollar in five years, and a business is worth the sum of all the cash it will ever hand back to its owners, adjusted for that fact."},
    {"type":"h2","text":"The three inputs that actually matter"},
    {"type":"p","text":"Every DCF model boils down to three assumptions: how fast will free cash flow grow, for how long, and at what rate do we discount future cash back to today''s dollars (the discount rate, usually tied to the company''s cost of capital)."},
    {"type":"p","text":"Small changes in these inputs swing the output wildly — which is the most important thing to understand about DCF. A model isn''t a precise number, it''s a sensitivity exercise. The point isn''t \"this stock is worth exactly $142.37.\" The point is \"under reasonable assumptions, the stock looks cheap, fair, or expensive relative to where it trades today.\""},
    {"type":"h2","text":"Why free cash flow, not earnings"},
    {"type":"p","text":"Net income includes non-cash items and accounting choices that can be massaged. Free cash flow — operating cash flow minus capital expenditures — is closer to the actual cash a business could pay out to shareholders. That''s what a DCF discounts, because that''s what an owner actually receives."},
    {"type":"h2","text":"Reading the output as a margin of safety"},
    {"type":"p","text":"The useful way to use a DCF isn''t to trust the exact fair value number. It''s to compare the current price against a range of outcomes. If a stock trades well below even a conservative DCF estimate, you have a margin of safety — room for your assumptions to be wrong and still come out ahead. If it trades well above even an optimistic estimate, the market is pricing in years of perfect execution."},
    {"type":"h2","text":"The shortcut"},
    {"type":"p","text":"Building a full DCF by hand requires forecasting revenue, margins, capex, and a terminal value — easy to get wrong. Traqcker runs a simplified fair value estimate (based on the Graham formula and current fundamentals) on every stock page, so you get a sanity check on valuation without opening a spreadsheet."}
  ]'::jsonb,
  true
),
(
  'pe-ratio-explained',
  'P/E ratio explained simply — and when it lies to you',
  'The price-to-earnings ratio is the most quoted number in investing, and also the most misused. Here''s what it tells you and what it hides.',
  '2026-06-10',
  '3 min read',
  'Fundamentals',
  '{}',
  '[
    {"type":"p","text":"P/E ratio = stock price ÷ earnings per share. A stock trading at $50 with $5 in annual earnings per share has a P/E of 10 — meaning you''re paying 10 times this year''s profit for a share of the company."},
    {"type":"h2","text":"What a low P/E really means"},
    {"type":"p","text":"A low P/E can mean a stock is undervalued. It can also mean the market expects earnings to fall — declining industries, one-time profit spikes, or accounting gains that won''t repeat all show up as a deceptively low P/E. The number alone never tells you which case you''re looking at."},
    {"type":"h2","text":"What a high P/E really means"},
    {"type":"p","text":"A high P/E often reflects expected growth — the market is paying up for earnings it believes will be much bigger in a few years. Sometimes that growth materializes. Sometimes the multiple was simply too optimistic and compresses hard when growth disappoints."},
    {"type":"h2","text":"The fix: compare P/E to growth and quality"},
    {"type":"p","text":"P/E means little in isolation. Pair it with: revenue growth (is the multiple justified by the trajectory?), ROIC (is the business actually efficient, or is the P/E low because it deserves to be?), and the sector average (a 25 P/E is expensive for a utility, cheap for a software company)."},
    {"type":"p","text":"Traqcker shows P/E alongside ROIC, margins, and growth on every stock page specifically so the number isn''t read on its own."}
  ]'::jsonb,
  true
)
on conflict (slug) do nothing;
