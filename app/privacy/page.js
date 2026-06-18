'use client';
import Topbar from '../components/Topbar';

export default function Privacy() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>LEGAL</div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '8px' }}>Privacy Policy</h1>
        <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '40px' }}>Last updated: June 2026 · Governed by UK GDPR and the Data Protection Act 2018</div>

        {[
          {
            title: '1. Who We Are',
            content: 'Traqcker is operated as an independent project by Pablo Rodriguez, based in the United Kingdom. We operate the website traqcker.com and related services. For data protection matters, contact us at hello@traqcker.com.'
          },
          {
            title: '2. What Data We Collect',
            content: `We collect the following categories of personal data:

- Account data: email address, name, and authentication credentials when you register via Clerk.
- Payment data: subscription status and billing history. Payment card details are processed directly by Stripe and never stored on our servers.
- Usage data: pages visited, features used, and stock tickers searched, used to improve the service.
- Technical data: IP address, browser type, device type, and cookies necessary for the service to function.
- Communications: any messages you send to us via email.`
          },
          {
            title: '3. Legal Basis for Processing (UK GDPR Art. 6)',
            content: `We process your data on the following legal bases:

- Contract (Art. 6(1)(b)): to provide the Traqcker service you have subscribed to, including account management and subscription billing.
- Legitimate interests (Art. 6(1)(f)): to improve our service, prevent fraud, and ensure security.
- Consent (Art. 6(1)(a)): for non-essential cookies and analytics, where you have given explicit consent via our cookie banner.
- Legal obligation (Art. 6(1)(c)): where required by applicable UK law.`
          },
          {
            title: '4. How We Use Your Data',
            content: `We use your personal data to:

- Create and manage your account
- Process subscription payments via Stripe
- Provide access to Pro features based on your subscription status
- Improve and personalise the service
- Send essential service communications (account confirmations, billing receipts)
- Detect and prevent fraud or abuse
- Comply with legal obligations

We do not sell, rent, or share your personal data with third parties for marketing purposes.`
          },
          {
            title: '5. Third Party Services and International Transfers',
            content: `We use the following third-party services to operate Traqcker:

- Clerk (clerk.com) — authentication and user management. Data may be processed in the USA. Clerk is certified under the EU-US Data Privacy Framework.
- Stripe (stripe.com) — payment processing. Data processed in the USA and EU. Stripe is PCI DSS compliant.
- Supabase (supabase.com) — database and data storage. Data stored in EU regions where available.
- Vercel (vercel.com) — website hosting and deployment. Data may be processed in the USA and EU.
- Finnhub (finnhub.io) — financial market data API.
- SEC EDGAR — public financial filing data from the US Securities and Exchange Commission.

Where data is transferred outside the UK, we ensure appropriate safeguards are in place in accordance with UK GDPR Chapter V.`
          },
          {
            title: '6. Cookies',
            content: `We use the following types of cookies:

- Essential cookies: required for authentication, session management, and core functionality. These cannot be declined as the service cannot function without them.
- Analytics cookies: used to understand how visitors interact with our website. Only set with your explicit consent.
- Preference cookies: used to remember your settings and preferences.

You can manage your cookie preferences at any time via our cookie banner or your browser settings. Withdrawing consent for non-essential cookies does not affect the lawfulness of processing prior to withdrawal.`
          },
          {
            title: '7. Data Retention',
            content: `We retain your personal data for the following periods:

- Account data: for the duration of your account, plus 12 months after account deletion to comply with legal obligations.
- Payment and billing records: 7 years as required by UK tax law.
- Usage and analytics data: up to 24 months in aggregated or anonymised form.
- Communications: up to 3 years.

After these periods, data is securely deleted or anonymised.`
          },
          {
            title: '8. Your Rights Under UK GDPR',
            content: `As a UK data subject, you have the following rights:

- Right of access: request a copy of the personal data we hold about you.
- Right to rectification: request correction of inaccurate or incomplete data.
- Right to erasure: request deletion of your personal data ("right to be forgotten").
- Right to restriction: request we limit how we use your data.
- Right to data portability: receive your data in a structured, machine-readable format.
- Right to object: object to processing based on legitimate interests.
- Rights related to automated decision-making: we do not make solely automated decisions with legal or significant effects.

To exercise any of these rights, contact us at hello@traqcker.com. We will respond within 30 days. You will not be charged for making a request.`
          },
          {
            title: '9. Right to Complain',
            content: 'If you are unhappy with how we handle your personal data, you have the right to lodge a complaint with the UK Information Commissioner\'s Office (ICO) at ico.org.uk or by calling 0303 123 1113. We would appreciate the opportunity to address your concerns before you contact the ICO.'
          },
          {
            title: '10. Data Security',
            content: 'We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, accidental loss, destruction, or damage. These include encrypted data transmission (HTTPS), access controls, and regular security reviews. In the event of a data breach that poses a risk to your rights and freedoms, we will notify the ICO within 72 hours and affected users without undue delay.'
          },
          {
            title: '11. Children\'s Privacy',
            content: 'Traqcker is not directed at children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us at hello@traqcker.com.'
          },
          {
            title: '12. Changes to This Policy',
            content: 'We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on our website at least 14 days before changes take effect. Continued use of the service after that date constitutes acceptance of the updated policy.'
          },
          {
            title: '13. Contact Us',
            content: 'For any privacy-related questions or requests, contact us at hello@traqcker.com. We aim to respond within 5 business days.'
          },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{s.title}</div>
            <div style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}