'use client';
import { formatCurrency } from '../../../../lib/formatters';
import { NEW_COLORS as C } from '../theme';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£' };

const ICONS = { BUY: '🟢', SELL: '🔴', dividend: '💰' };

function describe(item) {
  if (item.type === 'dividend') return 'Dividendo';
  if (item.action === 'BUY') return 'Compra';
  if (item.action === 'SELL') return 'Venta';
  return 'Operación'; // action unknown — see lib/trading212Sync.js
}

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function ActivityFeed({ activity }) {
  if (!activity || activity.length === 0) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.8px', marginBottom: '12px', textTransform: 'uppercase' }}>
        Actividad reciente
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '460px', overflowY: 'auto' }}>
        {activity.map(item => {
          const icon = item.type === 'dividend' ? ICONS.dividend : (ICONS[item.action] || '⚪');
          const amountStr = item.amount != null
            ? formatCurrency(item.amount, CURRENCY_SYMBOLS[item.currency] || (item.currency ? `${item.currency} ` : '$'))
            : null;
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${C.borderSoft}` }}>
              <span style={{ fontSize: '14px', width: '18px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.ink }}>
                  {describe(item)}{item.ticker ? ` · ${item.ticker}` : ''}
                </div>
                {item.quantity != null && (
                  <div style={{ fontSize: '11px', color: C.text3 }}>
                    {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} acc.
                    {item.price != null ? ` @ ${formatCurrency(item.price, CURRENCY_SYMBOLS[item.currency] || '$')}` : ''}
                  </div>
                )}
                {/* Only ever present on a sell (Trading 212 computes it from the position's real
                    cost basis) — the actual realized gain/loss, not just the sale proceeds shown
                    on the right. In the account's own base currency, which can differ from the
                    instrument's own currency shown above. */}
                {item.realized_pl != null && (
                  <div style={{ fontSize: '11px', fontWeight: 700, color: item.realized_pl >= 0 ? C.green : C.red }}>
                    {item.realized_pl >= 0 ? '+' : ''}
                    {formatCurrency(item.realized_pl, CURRENCY_SYMBOLS[item.realized_pl_currency] || (item.realized_pl_currency ? `${item.realized_pl_currency} ` : ''))} realizado
                  </div>
                )}
              </div>
              {amountStr && (
                <div style={{ fontSize: '12px', fontWeight: 700, color: item.action === 'SELL' || item.type === 'dividend' ? C.green : C.ink }}>
                  {amountStr}
                </div>
              )}
              <div style={{ fontSize: '11px', color: C.text3, width: '48px', textAlign: 'right', flexShrink: 0 }}>{formatWhen(item.occurred_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
