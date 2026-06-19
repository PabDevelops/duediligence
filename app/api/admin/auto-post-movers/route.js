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

async function generatePostContent(ticker, name, price, change, sector) {
  const prompt = `Generate a concise financial analysis blog post about ${name} (${ticker}) which is up ${change.toFixed(2)}% today and is in the ${sector} sector.

The post should:
1. Start with why this stock is trending today (the price movement)
2. Include 2-3 key metrics to watch for this company
3. End with a brief investment consideration

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

Keep paragraphs concise (2-3 sentences max). Make it actionable and informative.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                     responseText.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      return null;
    }

    const postData = JSON.parse(jsonMatch[1]);
    return postData;
  } catch (error) {
    console.error('Error generating content:', error);
    return null;
  }
}

export async function POST(req) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    // Get top 5 gainers
    const { data: rows } = await supabase
      .from('stock_cache')
      .select('ticker, data')
      .not('data->currentPrice', 'is', null)
      .not('data->priceChangePct', 'is', null)
      .order('data->priceChangePct', { ascending: false })
      .limit(5);

    if (!rows?.length) {
      return Response.json({ error: 'No stocks found', created: [] });
    }

    const created = [];

    for (const row of rows) {
      const ticker = row.ticker;
      const data = row.data;
      const change = data.priceChangePct;

      if (change < 2) continue; // Only post stocks with >2% gain

      const slug = slugify(`${data.name}-${ticker}-${new Date().toISOString().split('T')[0]}`);

      // Check if post already exists
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', slug);

      if (existing?.length) {
        console.log(`Post already exists for ${ticker}`);
        continue;
      }

      // Generate content
      const postContent = await generatePostContent(
        ticker,
        data.name,
        data.currentPrice,
        change,
        data.sector || 'Technology'
      );

      if (!postContent) {
        console.log(`Failed to generate content for ${ticker}`);
        continue;
      }

      // Insert post
      const { error: insertError } = await supabase
        .from('blog_posts')
        .insert({
          slug,
          title: postContent.title,
          description: postContent.description,
          date: new Date().toISOString().split('T')[0],
          read_time: '3 min read',
          tag: 'Market Movers',
          tickers: [ticker],
          sentiment: change > 5 ? 'positive' : 'neutral',
          author: 'Market Analysis',
          content: JSON.stringify(postContent.content),
          published: true,
        });

      if (insertError) {
        console.error(`Error inserting post for ${ticker}:`, insertError);
      } else {
        created.push({ ticker, title: postContent.title, slug });
      }
    }

    return Response.json({
      success: true,
      created,
      message: `Created ${created.length} posts`,
    });
  } catch (error) {
    console.error('Auto-post error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
