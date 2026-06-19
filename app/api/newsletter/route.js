import { supabase } from '../../../lib/supabase';
import { checkIsAdmin } from '../../../lib/isAdmin';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';
import { Resend } from 'resend';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const welcomeEmailHTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .box { padding: 20px; background-color: #f8f9fa; border-radius: 8px; }
        h1 { color: #1f2937; margin: 0 0 16px 0; font-size: 24px; }
        p { color: #4b5563; line-height: 1.6; margin: 0 0 16px 0; }
        .highlight { padding: 16px; background-color: #fff; border-left: 4px solid #3b82f6; margin: 0 0 16px 0; border-radius: 4px; }
        .highlight p { margin: 0; }
        .highlight strong { font-weight: 600; }
        .footer { color: #9ca3af; font-size: 12px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="box">
          <h1>Welcome to Due Diligence! 📊</h1>
          <p>Hi! Thanks for subscribing to our newsletter. You'll now get insights on stock analysis, market trends, and financial research straight to your inbox.</p>
          <div class="highlight">
            <p><strong>What to expect:</strong></p>
            <p>• Stock analysis & sentiment indicators<br/>
            • Market movers & trending companies<br/>
            • Financial insights & research</p>
          </div>
          <p>Have any questions? You can reply to this email anytime.</p>
          <p class="footer">© 2026 Due Diligence. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
`;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req) {
  const ip = getClientIp(req);
  const { ok } = rateLimit(`newsletter:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!ok) {
    return Response.json({ error: 'Too many requests, try again in a minute' }, { status: 429 });
  }

  const { email, source } = await req.json();

  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'Enter a valid email' }, { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();

  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email: cleanEmail, source: source || 'landing' }, { onConflict: 'email', ignoreDuplicates: true });

  if (error) return Response.json({ error: 'Something went wrong' }, { status: 500 });

  // Send welcome email if Resend is configured
  if (resend) {
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: cleanEmail,
        subject: 'Welcome to Due Diligence! 📊',
        html: welcomeEmailHTML,
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
    }
  }

  return Response.json({ success: true });
}

export async function GET() {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('email, source, created_at')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ subscribers: data || [], count: data?.length || 0 });
}
