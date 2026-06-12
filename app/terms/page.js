'use client';
import Topbar from '../components/Topbar';

export default function Terms() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '12px' }}>LEGAL</div>
        <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '8px' }}>Terms of Service</h1>
        <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '40px' }}>Last updated: June 2026 · Governed by the laws of England and Wales</div>

        {[
          {
            title: '1. Acceptance of Terms',
            content: 'By accessing or using Traqcker ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally binding agreement between you and Traqcker, operated by Pablo Rodriguez, United Kingdom.'
          },
          {
            title: '2. Description of Service',
            content: `Traqcker provides a web-based platform for fundamental stock analysis, including:

- Stock data sourced from SEC EDGAR (US public filings), Finnhub, and Yahoo Finance
- Proprietary scoring models based on publicly available financial data
- Financial statement analysis tools
- DCF and Graham valuation models
- Stock screener and comparison tools (Pro)
- Watchlist functionality

The Service is provided on both a free and paid subscription basis, as described in Section 5.`
          },
          {
            title: '3. Important Disclaimer — Not Investment Advice',
            content: `PLEASE READ THIS SECTION CAREFULLY.

Nothing on Traqcker constitutes investment advice, financial advice, trading advice, or any other type of advice. Traqcker is an informational tool only.

- All data, scores, valuations, and analyses are for informational purposes only.
- Past performance of any stock or model is not indicative of future results.
- The Traqcker Score and any other proprietary metrics are automated calculations and should not be relied upon as recommendations.
- You should always conduct your own independent research and consult a qualified, authorised financial adviser before making any investment decisions.
- Traqcker is not authorised or regulated by the Financial Conduct Authority (FCA).`
          },
          {
            title: '4. User Accounts',
            content: `To access certain features of the Service, you must create an account. You agree to:

- Provide accurate and complete information during registration
- Maintain the security of your account credentials
- Notify us immediately of any unauthorised access to your account
- Be responsible for all activity that occurs under your account

You must be at least 18 years old to create an account. We reserve the right to suspend or terminate accounts that violate these Terms.`
          },
          {
            title: '5. Subscription Plans and Payments',
            content: `Traqcker offers the following plans:

Free Plan: Access to stock overviews, quality scorecards, market data, and sparklines. No payment required.

Pro Plan: Full access to all features including financial statements, DCF valuation, stock screener, compare tool, and watchlist. Available on monthly ($11.99/month) or annual ($119.88/year, equivalent to $9.99/month) billing cycles.

Payments are processed securely by Stripe. By subscribing to a Pro plan, you authorise Stripe to charge your payment method on a recurring basis.

You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. We do not offer refunds for partial billing periods except where required by applicable law.

We reserve the right to change pricing with at least 30 days' written notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.`
          },
          {
            title: '6. Refund Policy',
            content: `We offer refunds in the following circumstances:

- If you are charged in error due to a technical fault on our part
- Within 14 days of your first subscription purchase if you have not used the Pro features (statutory cooling-off period under UK Consumer Contracts Regulations 2013)
- At our discretion in exceptional circumstances

To request a refund, contact us at hello@traqcker.com with your account email and reason for the request. We will process eligible refunds within 5-10 business days.`
          },
          {
            title: '7. Intellectual Property',
            content: `All content on Traqcker, including but not limited to the scoring methodology, design, code, text, and graphics, is the property of Traqcker and protected by applicable intellectual property laws.

You are granted a limited, non-exclusive, non-transferable licence to access and use the Service for your personal, non-commercial purposes.

You may not:
- Copy, reproduce, or distribute any part of the Service without permission
- Reverse engineer or attempt to extract the source code
- Use the Service to build a competing product
- Systematically scrape or harvest data from the Service

Financial data sourced from SEC EDGAR is in the public domain. Data from Finnhub and Yahoo Finance is subject to their respective terms of service.`
          },
          {
            title: '8. Prohibited Conduct',
            content: `You agree not to:

- Use the Service for any unlawful purpose or in violation of any applicable laws
- Attempt to gain unauthorised access to any part of the Service or its infrastructure
- Transmit any malicious code, viruses, or harmful content
- Interfere with or disrupt the integrity or performance of the Service
- Use automated tools to access the Service at a rate that exceeds normal human usage
- Impersonate any person or entity
- Engage in any conduct that restricts or inhibits any other user's enjoyment of the Service`
          },
          {
            title: '9. Data Accuracy and Availability',
            content: 'While we strive to provide accurate and up-to-date financial data, we cannot guarantee the completeness, accuracy, or timeliness of any data on the Service. Financial data is sourced from third parties and may contain errors, delays, or omissions. We are not responsible for any inaccuracies in third-party data. The Service is provided "as is" and we do not warrant that it will be uninterrupted, error-free, or free from bugs or viruses.'
          },
          {
            title: '10. Limitation of Liability',
            content: `To the maximum extent permitted by applicable law:

- Traqcker shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, investment losses, or loss of data.
- Our total liability to you for any claim arising from your use of the Service shall not exceed the amount you paid to us in the 12 months preceding the claim.
- Nothing in these Terms excludes or limits our liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.`
          },
          {
            title: '11. Indemnification',
            content: 'You agree to indemnify and hold harmless Traqcker and its operators from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.'
          },
          {
            title: '12. Termination',
            content: 'We reserve the right to suspend or terminate your account and access to the Service at any time, with or without notice, for conduct that we believe violates these Terms or is otherwise harmful to other users, us, or third parties. Upon termination, your right to use the Service will immediately cease. If your account is terminated for cause, you will not be entitled to a refund.'
          },
          {
            title: '13. Changes to Terms',
            content: 'We reserve the right to modify these Terms at any time. For material changes, we will provide at least 14 days\' notice via email or a prominent notice on the website. Your continued use of the Service after the effective date of the changes constitutes your acceptance of the updated Terms. If you do not agree to the updated Terms, you must stop using the Service.'
          },
          {
            title: '14. Governing Law and Dispute Resolution',
            content: 'These Terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from or in connection with these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of England and Wales. If you are a consumer, you may also have rights under the laws of your country of residence.'
          },
          {
            title: '15. Contact Us',
            content: 'For any questions about these Terms, contact us at hello@traqcker.com. We aim to respond within 5 business days.'
          },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 600, letterSpacing: '1px', marginBottom: '12px' }}>{s.title}</div>
            <div style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}