import { supabase } from '../../../../lib/supabase';
import { checkIsAdmin } from '../../../../lib/isAdmin';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Educational topics only — no speculation about daily price moves or news.
// Each topic is a well-established finance concept that can be explained accurately
// without needing real-time data or unverifiable claims about "why" something happened today.
const TOPICS = [
  { slug: 'free-cash-flow-yield-explained', tag: 'Valuation', subject: 'Free Cash Flow Yield: what it is and why it beats earnings yield for value investors' },
  { slug: 'gross-margin-vs-operating-margin', tag: 'Fundamentals', subject: 'Gross margin vs operating margin: what each one tells you about a business' },
  { slug: 'debt-to-equity-ratio-explained', tag: 'Fundamentals', subject: 'Debt-to-equity ratio: how much leverage is too much' },
  { slug: 'margin-of-safety-investing', tag: 'Valuation', subject: 'Margin of safety: the core idea behind value investing' },
  { slug: 'revenue-growth-vs-profit-growth', tag: 'Fundamentals', subject: 'Revenue growth vs profit growth: why growing sales can still mean a bad investment' },
  { slug: 'price-to-book-ratio-explained', tag: 'Valuation', subject: 'Price-to-book ratio: when it matters and when it is meaningless' },
  { slug: 'understanding-stock-buybacks', tag: 'Fundamentals', subject: 'Stock buybacks: how to tell if they create value or just prop up EPS' },
  { slug: 'what-is-working-capital', tag: 'Fundamentals', subject: 'Working capital: a simple way to judge short-term financial health' },
  { slug: 'dividend-yield-vs-payout-ratio', tag: 'Fundamentals', subject: 'Dividend yield vs payout ratio: which one actually predicts dividend cuts' },
  { slug: 'how-to-read-a-balance-sheet', tag: 'Fundamentals', subject: 'How to read a balance sheet in five minutes' },
  { slug: 'eps-growth-can-be-misleading', tag: 'Fundamentals', subject: 'Why EPS growth alone can be a misleading signal' },
  { slug: 'understanding-enterprise-value', tag: 'Valuation', subject: 'Enterprise value vs market cap: the number that includes debt' },
];

async function generateEducationalPost(subject, tag) {
  const prompt = `Write an educational finance blog post explaining this topic: "${subject}".

Audience: retail investors who are not finance professionals but want to understand fundamentals properly.

Rules:
- Only explain well-established financial concepts and formulas. Do not reference specific companies' current stock prices, today's news, or any real-time/recent events.
- You may use illustrative numeric examples (e.g. "a company with $100M revenue and $20M profit") but do not claim these are real companies' actual figures.
- Be precise and accurate about the financial concept itself.

Format the response as JSON with this structure:
{
  "title": "Post title (40-60 chars)",
  "description": "Meta description (100-120 chars)",
  "content": [
    {"type": "p", "text": "paragraph text"},
    {"type": "h2", "text": "heading"},
    ...
  ]
}

Write 4-6 paragraphs/headings total. Keep paragraphs concise (2-3 sentences max).`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                     responseText.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      return null;
    }

    return JSON.parse(jsonMatch[1]);
  } catch (error) {
    console.error('Error generating content:', error);
    return null;
  }
}

export async function POST(req) {
  const cronToken = req.headers.get('X-Cron-Secret');
  const isCron = cronToken && process.env.CRON_SECRET && cronToken === process.env.CRON_SECRET;

  if (!isCron) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
  }

  try {
    // Find topics not yet published
    const { data: existingPosts } = await supabase
      .from('blog_posts')
      .select('slug');

    const existingSlugs = new Set((existingPosts || []).map(p => p.slug));
    const availableTopics = TOPICS.filter(t => !existingSlugs.has(t.slug));

    if (!availableTopics.length) {
      return Response.json({ success: true, created: [], message: 'All educational topics already published' });
    }

    // Generate one post per run
    const topic = availableTopics[0];
    const postContent = await generateEducationalPost(topic.subject, topic.tag);

    if (!postContent) {
      return Response.json({ error: 'Failed to generate content', created: [] }, { status: 500 });
    }

    const { error: insertError } = await supabase
      .from('blog_posts')
      .insert({
        slug: topic.slug,
        title: postContent.title,
        description: postContent.description,
        date: new Date().toISOString().split('T')[0],
        read_time: '4 min read',
        tag: topic.tag,
        tickers: [],
        sentiment: 'neutral',
        author: 'Traqcker Team',
        content: JSON.stringify(postContent.content),
        published: true,
      });

    if (insertError) {
      console.error('Error inserting post:', insertError);
      return Response.json({ error: insertError.message, created: [] }, { status: 500 });
    }

    return Response.json({
      success: true,
      created: [{ slug: topic.slug, title: postContent.title }],
      message: 'Created 1 educational post',
    });
  } catch (error) {
    console.error('Auto-post error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
