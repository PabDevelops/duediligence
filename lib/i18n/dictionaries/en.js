export default {
  common: {
    signIn: 'Sign in',
    startFreeTrial: 'Start free',
  },

  topbar: {
    about: 'About',
    pricing: 'Pricing',
    faq: 'FAQ',
    signIn: 'Sign in',
    startFreeTrial: 'Start free',
    home: 'Home',
  },

  cookieBanner: {
    message: 'We use cookies to improve your experience and analyse site usage. By continuing you agree to our',
    privacyPolicy: 'Privacy Policy',
    and: 'and',
    termsOfService: 'Terms of Service',
    decline: 'Decline',
    accept: 'Accept',
  },

  newsletter: {
    title: 'Get one stock breakdown a week',
    subtitle: 'No spam. Unsubscribe anytime.',
    placeholder: 'you@email.com',
    subscribe: 'Subscribe',
    joining: 'Joining...',
    doneTitle: "You're in.",
    doneSubtitle: 'Watch your inbox for the next breakdown.',
    genericError: 'Something went wrong',
  },

  home: {
    nav: { product: 'Product', pricing: 'Pricing', faq: 'FAQ' },
    signIn: 'Sign in',
    cta: 'Try the Terminal →',
    hero: {
      title: 'This is the Terminal. Try it now.',
      subtitle: 'Direct SEC filings, DCF valuation, and a quantitative screener — live in your browser. No signup required to look around.',
    },
    footer: {
      tagline: 'Structured first-party data and AI utilities for public market investors.',
      product: 'Product',
      pricingLink: 'Pricing',
      proFeatures: 'Pro Features',
      company: 'Company',
      aboutUs: 'About Us',
      faqLink: 'FAQ',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
    },
  },

  about: {
    hero: {
      eyebrow: 'OUR STORY',
      title: 'Investment research infrastructure, built on primary sources.',
      subtitle: 'Traqcker gives independent analysts and retail investors direct, unfiltered access to clean public company filings, financial scores, and portfolio analysis.',
      ctaPrimary: 'Start free →',
      ctaSecondary: 'Explore the Terminal',
    },
    bento: {
      eyebrow: "What we've built",
      title: 'One workspace, straight from the source',
      tiles: [
        { badge: 'TERMINAL & SCREENER', title: 'Direct SEC Financials', desc: 'Every margin, cash conversion figure, and Graham fair value is computed straight from the filing, not a third-party summary.' },
        { badge: 'PORTFOLIO', title: 'Multi-Currency Tracker', desc: 'Positions, gain/loss, and allocation in your own reporting currency, across any exchange.' },
        { badge: 'SCREENER', title: 'Quantitative Universe Filter', desc: 'Rank thousands of global equities by margin, FCF yield, debt profile, and dilution in seconds.' },
        { badge: 'LIVE COVERAGE', title: 'Global Filing & Price Feed', desc: 'Real-time alerts the moment filings hit SEC EDGAR, with watchlists that sync prices and currency rates continuously.' },
      ],
    },
    letter: {
      quote: 'In investment research, verified facts are the only currency that matters.',
      paragraphs: [
        "Most investment tools are designed to overwhelm you with complex jargon or push you into trades that generate commissions. They give you numbers, but they don't help you understand the quality of the business.",
        'We believe independent researchers shouldn\'t have to spend thousands of dollars a year to access clean, direct financial data. At Traqcker, we go straight to the primary source. We fetch files directly from regulatory bodies, compute margins transparently, and map them to historical visual models.',
        "When you evaluate a stock on Traqcker, you don't just see a quality score. You can click on any metric to inspect the exact line in the company's financial reports. We believe in total transparency, facts over predictions, and absolute clarity.",
      ],
    },
    why: {
      eyebrow: 'WHY TRAQCKER EXISTS',
      items: [
        { title: 'No Analyst Bias', desc: "We don't publish speculative target prices or buy/sell recommendations. We provide the historical data, quality score, and intrinsic calculations so you can make your own decisions." },
        { title: 'Source Transparency', desc: 'Every calculation on our platform is open and verifiable. Clicking any number opens a direct reference to the SEC EDGAR filing row so you can audit the source yourself.' },
        { title: 'Multi-Currency Standard', desc: 'We normalize global assets under one unified interface, converting local currencies and tickers automatically so you can evaluate domestic and foreign positions side-by-side.' },
        { title: 'Clean Speed', desc: 'A high-performance workspace caching system allows you to load watchlists and portfolios instantly, refreshing prices in the background without locking up the UI.' },
      ],
    },
    methodology: {
      eyebrow: 'HOW THE SCORE WORKS',
      title: 'The Traqcker Score, step by step',
      capsule: 'Traqcker turns free cash flow into a single quality-adjusted score for 260+ companies through four sequential calculation steps.',
      steps: [
        {
          title: '1. FCF Base Value',
          capsule: "The FCF Base Value is a company's starting valuation, calculated directly from its reported free cash flow before any adjustments.",
          desc: "This is the foundation of the score: a valuation figure built straight from free cash flow, before any quality, balance sheet, or risk adjustment is layered on top.",
        },
        {
          title: '2. Quality Multiplier',
          capsule: 'The Quality Multiplier raises or lowers that base value using business quality metrics such as margins, returns, and consistency.',
          desc: 'Businesses with stronger, more durable economics get a higher multiplier applied to their base value; weaker-quality businesses get discounted.',
        },
        {
          title: '3. Balance Sheet Adjustment',
          capsule: 'The Balance Sheet Adjustment factors in balance sheet strength or risk, rewarding low debt and penalizing heavy leverage.',
          desc: 'A company with a conservative balance sheet is adjusted more favorably than one carrying heavy debt or other structural balance sheet risk.',
        },
        {
          title: '4. Fundamentals Penalty',
          capsule: 'The Fundamentals Penalty reduces the score when fundamental weaknesses appear, helping guard against classic value traps.',
          desc: 'The final step subtracts points when specific fundamental red flags are present, so a cheap-looking score is not mistaken for a healthy business.',
        },
      ],
      survival: {
        title: 'What if free cash flow is negative?',
        capsule: 'Companies with negative free cash flow skip the four-step score entirely and get a separate Pre-FCF Survival Score instead.',
        desc: 'Rather than excluding unprofitable or early-stage companies from the screener, Traqcker applies a dedicated Pre-FCF Survival Score designed to assess their viability on its own terms.',
      },
      sources: {
        title: 'Data sources: SEC EDGAR & Finnhub',
        capsule: 'Every Traqcker score is grounded in primary financial statements pulled directly from SEC EDGAR filings and Finnhub, not estimates.',
        desc: 'Scores are computed from primary-source data rather than third-party summaries, so every figure can be traced back to the original filing.',
      },
    },
    tldr: {
      title: 'TL;DR',
      items: [
        'Traqcker scores 260+ public companies using a proprietary GARP-based, free-cash-flow-first framework.',
        'Scoring runs through 4 steps: FCF Base Value, Quality Multiplier, Balance Sheet Adjustment, Fundamentals Penalty.',
        'Companies with negative free cash flow get a separate Pre-FCF Survival Score instead of being excluded.',
        'All data is sourced directly from SEC EDGAR filings and Finnhub.',
        'Full access is $14.99/month or $119.99/year, with a 14-day free trial and no credit card required.',
      ],
    },
    team: {
      eyebrow: 'THE TEAM',
      name: 'Pablo Rodriguez',
      role: 'Founder',
      bio: 'Built Traqcker out of frustration with tools that were either too expensive or too complex. Wanted something honest, simple, and actually useful for normal investors.',
    },
    finalCta: {
      title: 'Start your research today.',
      subtitle: 'Create a free account for full valuation tools and an uncapped screener. No credit card required.',
      cta: 'Start free →',
    },
    footerNote: {
      disclaimer: 'Not investment advice · Data from public sources',
      copyright: '© 2026 Traqcker',
    },
  },

  pricing: {
    eyebrow: 'PLANS & PRICING',
    titleLine1: 'Free to start.',
    titleLine2: 'Upgrade when you need Pro.',
    subtitle: 'Create a free account for full valuation tools and an uncapped screener — no credit card. Upgrade to Pro for Portfolio, ETFs, and unlimited discovery.',
    monthly: 'Monthly',
    annual: 'Annual · Save 33%',
    badge: 'MOST POPULAR',
    planName: 'TRAQCKER PRO',
    free: {
      label: 'Free',
      price: '$0',
      suffix: 'no card required',
      cta: 'Create free account',
      features: [
        'Full DCF valuation, projections & Fair Value',
        'Quality Score on every stock',
        'Uncapped stock screener',
        'Saved watchlist',
        'Community voting & vote history',
      ],
    },
    proFeatures: [
      'Everything in Free',
      'Multi-currency Portfolio tracker',
      'Full ETF coverage',
      'Unlimited daily stock discovery',
    ],
    priceSuffixAnnual: '/month · billed $119.88/year',
    priceSuffixMonthly: '/month',
    ctaLoading: 'Loading...',
    ctaStart: 'Go Pro',
    ctaStartAnnual: '— Save 33%',
    footNote: 'Secure payment via Stripe · Cancel anytime · No hidden fees',
  },

  faq: {
    eyebrow: 'FREQUENTLY ASKED QUESTIONS',
    title: 'Questions, answered directly',
    subtitle: 'Short, direct answers about what Traqcker is, how the score works, and what it costs.',
    items: [
      {
        q: 'What is Traqcker?',
        a: 'Traqcker is an investment terminal for retail investors that combines a stock screener, portfolio tracking, and a news feed in one dashboard, using a GARP-based scoring system built on free cash flow.',
      },
      {
        q: "How does Traqcker's scoring work?",
        a: 'Traqcker scores each company in four steps: FCF Base Value, Quality Multiplier, Balance Sheet Adjustment, and Fundamentals Penalty. Companies with negative free cash flow get a Pre-FCF Survival Score instead.',
      },
      {
        q: 'How many companies does Traqcker cover?',
        a: 'Traqcker covers 260+ publicly traded companies, with data sourced from SEC EDGAR filings and Finnhub.',
      },
      {
        q: 'How much does Traqcker cost?',
        a: 'Traqcker is freemium: the free tier has capped features (some screener categories hidden, no non-US stock data until you create a free account). Full access includes a 14-day free trial with no credit card required, then $14.99/month or $119.99/year.',
      },
      {
        q: 'How is Traqcker different from screeners like Simply Wall St or Finchat?',
        a: "Traqcker is built specifically around GARP methodology with a proprietary cash-flow-based score, not generic multiples or traffic-light 'financial health' scores. It's a full terminal, not just a screener — portfolio tracking and a news feed live in the same interface.",
      },
      {
        q: 'Does Traqcker work for companies with no profits or negative free cash flow?',
        a: 'Yes. Instead of excluding them, Traqcker applies a Pre-FCF Survival Score designed to assess viability for early-stage or currently unprofitable companies.',
      },
      {
        q: 'Who built Traqcker?',
        a: 'Traqcker was built by Pablo (@pabloinvesting_), an independent investor and indie developer who also publishes equity research through Hawthorne & Fletcher Research.',
      },
      {
        q: 'Is there a free trial of Traqcker?',
        a: "Yes — Traqcker has a permanent, capped free tier, plus a 14-day free trial of full access that doesn't require a credit card.",
      },
      {
        q: "What's included in Traqcker's free tier?",
        a: 'The free tier includes the screener with some categories hidden and no data for non-US stocks. Creating a free account unlocks more categories and international market data.',
      },
    ],
  },

  startTrial: {
    eyebrow: 'START YOUR TRIAL',
    titleLine1: '14 days of Pro,',
    titleLine2: 'free.',
    subtitle: 'Full access to financials, screener, compare, and valuation tools. No card required to start.',
    monthly: 'Monthly',
    annual: 'Annual · Save 33%',
    planName: 'PRO',
    priceSuffixAnnual: '/month · billed $119.88/year after your trial',
    priceSuffixMonthly: '/month after your trial',
    features: [
      'Full financial statements',
      'Detailed valuation ratios',
      'Stock screener (thousands of global equities)',
      'Compare up to 3 stocks',
      'Vote history & accuracy tracking',
    ],
    ctaLoading: 'Loading...',
    ctaGoToTerminal: 'Go to terminal →',
    ctaStart: 'Start my free trial →',
    footNote: 'Secure payment via Stripe · Cancel anytime',
  },

  success: {
    badge: 'PAYMENT SUCCESSFUL',
    title: 'Welcome to Traqcker Pro',
    subtitle: 'Your subscription is now active. You have full access to all Pro features.',
    cta: 'Start exploring →',
    redirecting: 'Redirecting to home in 5 seconds...',
  },

  signIn: {
    windowTitle: '$ traq login',
    title: 'Welcome Back',
    subtitle: 'Sign in to access your terminal',
    google: 'Continue with Google',
    or: 'OR',
    emailLabel: 'EMAIL ADDRESS',
    passwordLabel: 'PASSWORD',
    forgotPassword: 'Forgot password?',
    submitLoading: 'Signing in...',
    submit: 'Sign in',
    noAccount: "Don't have an account?",
    signUpLink: 'Sign up',
  },

  signUp: {
    windowTitle: '$ traq register',
    title: 'Create Account',
    subtitle: 'Start your 14-day automatic free trial',
    checkInbox: 'Check your inbox at',
    checkInboxSuffix: 'to confirm your account.',
    goToSignIn: 'Go to Sign in',
    google: 'Sign up with Google',
    or: 'OR',
    emailLabel: 'EMAIL ADDRESS',
    passwordLabel: 'PASSWORD',
    submitLoading: 'Creating account...',
    submit: 'Sign up',
    hasAccount: 'Already have an account?',
    signInLink: 'Sign in',
  },

  privacy: {
    eyebrow: 'LEGAL',
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: June 2026 · Governed by UK GDPR and the Data Protection Act 2018',
    sections: [
      {
        title: '1. Who We Are',
        content: 'Traqcker is operated as an independent project by Pablo Rodriguez, based in the United Kingdom. We operate the website traqcker.com and related services. For data protection matters, contact us at hello@traqcker.com.',
      },
      {
        title: '2. What Data We Collect',
        content: `We collect the following categories of personal data:

- Account data: email address, name, and authentication credentials when you register via Supabase Auth.
- Payment data: subscription status and billing history. Payment card details are processed directly by Stripe and never stored on our servers.
- Usage data: pages visited, features used, and stock tickers searched, used to improve the service.
- Technical data: IP address, browser type, device type, and cookies necessary for the service to function.
- Communications: any messages you send to us via email.`,
      },
      {
        title: '3. Legal Basis for Processing (UK GDPR Art. 6)',
        content: `We process your data on the following legal bases:

- Contract (Art. 6(1)(b)): to provide the Traqcker service you have subscribed to, including account management and subscription billing.
- Legitimate interests (Art. 6(1)(f)): to improve our service, prevent fraud, and ensure security.
- Consent (Art. 6(1)(a)): for non-essential cookies and analytics, where you have given explicit consent via our cookie banner.
- Legal obligation (Art. 6(1)(c)): where required by applicable UK law.`,
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

We do not sell, rent, or share your personal data with third parties for marketing purposes.`,
      },
      {
        title: '5. Third Party Services and International Transfers',
        content: `We use the following third-party services to operate Traqcker:

- Stripe (stripe.com) — payment processing. Data processed in the USA and EU. Stripe is PCI DSS compliant.
- Supabase (supabase.com) — database, data storage, and authentication/user management. Data stored in EU regions where available.
- Vercel (vercel.com) — website hosting and deployment. Data may be processed in the USA and EU.
- Finnhub (finnhub.io) — financial market data API.
- SEC EDGAR — public financial filing data from the US Securities and Exchange Commission.

Where data is transferred outside the UK, we ensure appropriate safeguards are in place in accordance with UK GDPR Chapter V.`,
      },
      {
        title: '6. Cookies',
        content: `We use the following types of cookies:

- Essential cookies: required for authentication, session management, and core functionality. These cannot be declined as the service cannot function without them.
- Analytics cookies: used to understand how visitors interact with our website. Only set with your explicit consent.
- Preference cookies: used to remember your settings and preferences.

You can manage your cookie preferences at any time via our cookie banner or your browser settings. Withdrawing consent for non-essential cookies does not affect the lawfulness of processing prior to withdrawal.`,
      },
      {
        title: '7. Data Retention',
        content: `We retain your personal data for the following periods:

- Account data: for the duration of your account, plus 12 months after account deletion to comply with legal obligations.
- Payment and billing records: 7 years as required by UK tax law.
- Usage and analytics data: up to 24 months in aggregated or anonymised form.
- Communications: up to 3 years.

After these periods, data is securely deleted or anonymised.`,
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

To exercise any of these rights, contact us at hello@traqcker.com. We will respond within 30 days. You will not be charged for making a request.`,
      },
      {
        title: '9. Right to Complain',
        content: "If you are unhappy with how we handle your personal data, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at ico.org.uk or by calling 0303 123 1113. We would appreciate the opportunity to address your concerns before you contact the ICO.",
      },
      {
        title: '10. Data Security',
        content: 'We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, accidental loss, destruction, or damage. These include encrypted data transmission (HTTPS), access controls, and regular security reviews. In the event of a data breach that poses a risk to your rights and freedoms, we will notify the ICO within 72 hours and affected users without undue delay.',
      },
      {
        title: "11. Children's Privacy",
        content: 'Traqcker is not directed at children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us at hello@traqcker.com.',
      },
      {
        title: '12. Changes to This Policy',
        content: 'We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on our website at least 14 days before changes take effect. Continued use of the service after that date constitutes acceptance of the updated policy.',
      },
      {
        title: '13. Contact Us',
        content: 'For any privacy-related questions or requests, contact us at hello@traqcker.com. We aim to respond within 5 business days.',
      },
    ],
  },

  terms: {
    eyebrow: 'LEGAL',
    title: 'Terms of Service',
    lastUpdated: 'Last updated: June 2026 · Governed by the laws of England and Wales',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: 'By accessing or using Traqcker ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally binding agreement between you and Traqcker, operated by Pablo Rodriguez, United Kingdom.',
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

The Service is provided on both a free and paid subscription basis, as described in Section 5.`,
      },
      {
        title: '3. Important Disclaimer — Not Investment Advice',
        content: `PLEASE READ THIS SECTION CAREFULLY.

Nothing on Traqcker constitutes investment advice, financial advice, trading advice, or any other type of advice. Traqcker is an informational tool only.

- All data, scores, valuations, and analyses are for informational purposes only.
- Past performance of any stock or model is not indicative of future results.
- The Traqcker Score and any other proprietary metrics are automated calculations and should not be relied upon as recommendations.
- You should always conduct your own independent research and consult a qualified, authorised financial adviser before making any investment decisions.
- Traqcker is not authorised or regulated by the Financial Conduct Authority (FCA).`,
      },
      {
        title: '4. User Accounts',
        content: `To access certain features of the Service, you must create an account. You agree to:

- Provide accurate and complete information during registration
- Maintain the security of your account credentials
- Notify us immediately of any unauthorised access to your account
- Be responsible for all activity that occurs under your account

You must be at least 18 years old to create an account. We reserve the right to suspend or terminate accounts that violate these Terms.`,
      },
      {
        title: '5. Subscription Plans and Payments',
        content: `Traqcker offers the following plans:

Free Plan: Access to stock overviews, quality scorecards, market data, and sparklines. No payment required.

Pro Plan: Full access to all features including financial statements, DCF valuation, stock screener, compare tool, and watchlist. Available on monthly ($11.99/month) or annual ($119.88/year, equivalent to $9.99/month) billing cycles.

Payments are processed securely by Stripe. By subscribing to a Pro plan, you authorise Stripe to charge your payment method on a recurring basis.

You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. We do not offer refunds for partial billing periods except where required by applicable law.

We reserve the right to change pricing with at least 30 days' written notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.`,
      },
      {
        title: '6. Refund Policy',
        content: `We offer refunds in the following circumstances:

- If you are charged in error due to a technical fault on our part
- Within 14 days of your first subscription purchase if you have not used the Pro features (statutory cooling-off period under UK Consumer Contracts Regulations 2013)
- At our discretion in exceptional circumstances

To request a refund, contact us at hello@traqcker.com with your account email and reason for the request. We will process eligible refunds within 5-10 business days.`,
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

Financial data sourced from SEC EDGAR is in the public domain. Data from Finnhub and Yahoo Finance is subject to their respective terms of service.`,
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
- Engage in any conduct that restricts or inhibits any other user's enjoyment of the Service`,
      },
      {
        title: '9. Data Accuracy and Availability',
        content: 'While we strive to provide accurate and up-to-date financial data, we cannot guarantee the completeness, accuracy, or timeliness of any data on the Service. Financial data is sourced from third parties and may contain errors, delays, or omissions. We are not responsible for any inaccuracies in third-party data. The Service is provided "as is" and we do not warrant that it will be uninterrupted, error-free, or free from bugs or viruses.',
      },
      {
        title: '10. Limitation of Liability',
        content: `To the maximum extent permitted by applicable law:

- Traqcker shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, investment losses, or loss of data.
- Our total liability to you for any claim arising from your use of the Service shall not exceed the amount you paid to us in the 12 months preceding the claim.
- Nothing in these Terms excludes or limits our liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.`,
      },
      {
        title: '11. Indemnification',
        content: 'You agree to indemnify and hold harmless Traqcker and its operators from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.',
      },
      {
        title: '12. Termination',
        content: 'We reserve the right to suspend or terminate your account and access to the Service at any time, with or without notice, for conduct that we believe violates these Terms or is otherwise harmful to other users, us, or third parties. Upon termination, your right to use the Service will immediately cease. If your account is terminated for cause, you will not be entitled to a refund.',
      },
      {
        title: '13. Changes to Terms',
        content: "We reserve the right to modify these Terms at any time. For material changes, we will provide at least 14 days' notice via email or a prominent notice on the website. Your continued use of the Service after the effective date of the changes constitutes your acceptance of the updated Terms. If you do not agree to the updated Terms, you must stop using the Service.",
      },
      {
        title: '14. Governing Law and Dispute Resolution',
        content: 'These Terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from or in connection with these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of England and Wales. If you are a consumer, you may also have rights under the laws of your country of residence.',
      },
      {
        title: '15. Contact Us',
        content: 'For any questions about these Terms, contact us at hello@traqcker.com. We aim to respond within 5 business days.',
      },
    ],
  },
};
