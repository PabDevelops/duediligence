'use client';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PORTFOLIO_PROMPTS = [
  'Analyze my portfolio',
  "What's my best performer?",
  "What's my riskiest position?",
  'How diversified am I by sector?',
];

const TICKER_PROMPTS = [
  'Summarize the fundamentals',
  'What are the key risks?',
  'Is it overvalued?',
];

export default function WorkspaceChat() {
  const [ticker, setTicker] = useState('');
  const [portfolioMode, setPortfolioMode] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (overrideText) => {
    const text = overrideText ?? input;
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMsg.content,
        ticker: portfolioMode ? '' : ticker,
        usePortfolio: portfolioMode,
        history: next,
      }),
    });
    const data = await res.json();
    setLoading(false);
    const reply = res.status === 429
      ? `You've reached today's limit of ${data.limit} messages. Try again tomorrow.`
      : (data.reply || data.error || 'No response.');
    setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
  };

  const togglePortfolioMode = () => {
    setPortfolioMode(m => !m);
  };

  const quickPrompts = portfolioMode ? PORTFOLIO_PROMPTS : (ticker ? TICKER_PROMPTS : []);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq chat
          </span>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>Traq</div>
            <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>Traqcker&apos;s research assistant — ask about a stock&apos;s fundamentals, grounded in real data.</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={togglePortfolioMode}
              style={{
                height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600,
                border: '1px solid var(--ws-border)',
                background: portfolioMode ? 'var(--ws-accent)' : 'var(--ws-bg-1)',
                color: portfolioMode ? 'var(--ws-bg-1)' : 'var(--ws-text)',
                cursor: 'pointer',
              }}>
              My Portfolio
            </button>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="Ticker (optional)"
              disabled={portfolioMode}
              style={{
                width: '140px', height: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 600,
                border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)',
                color: 'var(--ws-text)', opacity: portfolioMode ? 0.5 : 1,
              }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--ws-text-3)', fontSize: '13px', textAlign: 'center', margin: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
            <div>
              {portfolioMode ? 'Ask about your portfolio.' : (ticker ? `Ask anything about ${ticker}.` : 'Set a ticker above, or ask a general question.')}
            </div>
            {quickPrompts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '480px' }}>
                {quickPrompts.map(p => (
                  <button key={p} onClick={() => send(p)}
                    style={{
                      padding: '6px 12px', fontSize: '11px', fontWeight: 600,
                      border: '1px solid var(--ws-border)', borderRadius: '999px',
                      background: 'var(--ws-bg-1)', color: 'var(--ws-text-2)', cursor: 'pointer',
                    }}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            <div className={m.role === 'assistant' ? 'traq-md' : undefined} style={{
              padding: '9px 12px', fontSize: '13px', lineHeight: 1.6,
              background: m.role === 'user' ? 'var(--ws-text)' : 'var(--ws-bg-1)',
              color: m.role === 'user' ? 'var(--ws-bg)' : 'var(--ws-text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--ws-border)',
              whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
            }}>
              {m.role === 'assistant'
                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                : m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ color: 'var(--ws-text-3)', fontSize: '12px' }}>Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask a question..."
          style={{ flex: 1, height: '38px', padding: '0 12px', fontSize: '13px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text)' }} />
        <button onClick={() => send()} disabled={loading}
          style={{ padding: '0 20px', fontSize: '13px', fontWeight: 600, background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', cursor: 'pointer' }}>
          Send
        </button>
      </div>
      <style>{`
        .traq-md > *:first-child { margin-top: 0; }
        .traq-md > *:last-child { margin-bottom: 0; }
        .traq-md h1, .traq-md h2, .traq-md h3 { font-weight: 700; margin: 12px 0 6px; line-height: 1.3; }
        .traq-md h1 { font-size: 15px; }
        .traq-md h2 { font-size: 14px; }
        .traq-md h3 { font-size: 13px; }
        .traq-md p { margin: 0 0 8px; }
        .traq-md ul, .traq-md ol { margin: 0 0 8px; padding-left: 18px; }
        .traq-md li { margin: 2px 0; }
        .traq-md strong { font-weight: 700; }
        .traq-md code { background: var(--ws-bg); border: 1px solid var(--ws-border); border-radius: 4px; padding: 1px 4px; font-size: 12px; }
        .traq-md table { border-collapse: collapse; margin: 0 0 8px; font-size: 12px; }
        .traq-md th, .traq-md td { border: 1px solid var(--ws-border); padding: 4px 8px; text-align: left; }
        .traq-md a { color: var(--ws-accent); }
      `}</style>
    </div>
  );
}
