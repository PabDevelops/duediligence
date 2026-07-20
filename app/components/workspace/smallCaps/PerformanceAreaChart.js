'use client';
import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const METRIC_CONFIG = {
  marketCap: { label: 'Market Cap', mainVal: '$184.16B', subLabel: 'Total Small Cap Universe Capitalization', multiplier: 1.0 },
  revenue: { label: 'Revenue', mainVal: '$92.40B', subLabel: 'Combined Annual Revenue', multiplier: 0.5 },
  fcf: { label: 'Free Cash Flow', mainVal: '$14.80B', subLabel: 'Total Free Cash Flow Generated', multiplier: 0.08 },
};

const TIMEFRAME_DATA = {
  Daily: {
    buybacksPct: 35.1, buybacksAmt: '$64.6B', buybacksMedian: 30, buybacksYoy: '+2.4%',
    dividendsPct: 57.0, dividendsAmt: '$104.9B', dividendsMedian: 50, dividendsYoy: '-1.1%',
    capexPct: 7.9, capexAmt: '$14.5B', capexMedian: 12, capexYoy: '+0.8%',
    buybacksCount: 212, dividendsCount: 135, capexCount: 144,
    chart: [
      { label: '9:30', val: 178, russell: 170, buybacks: 34, dividends: 58, capex: 8 },
      { label: '10:30', val: 180, russell: 171, buybacks: 35, dividends: 57, capex: 8 },
      { label: '11:30', val: 179, russell: 170, buybacks: 35, dividends: 57, capex: 8 },
      { label: '12:30', val: 182, russell: 172, buybacks: 35, dividends: 57, capex: 8 },
      { label: '1:30', val: 181, russell: 171, buybacks: 35, dividends: 57, capex: 8 },
      { label: '2:30', val: 183, russell: 173, buybacks: 35, dividends: 57, capex: 8 },
      { label: '3:30', val: 184, russell: 173.5, buybacks: 35, dividends: 57, capex: 8 },
      { label: '4:00', val: 184.16, russell: 174, buybacks: 35.1, dividends: 57, capex: 7.9 },
    ]
  },
  Weekly: {
    buybacksPct: 34.2, buybacksAmt: '$62.3B', buybacksMedian: 30, buybacksYoy: '+1.8%',
    dividendsPct: 58.1, dividendsAmt: '$105.9B', dividendsMedian: 50, dividendsYoy: '-0.9%',
    capexPct: 7.7, capexAmt: '$14.2B', capexMedian: 12, capexYoy: '+0.5%',
    buybacksCount: 208, dividendsCount: 138, capexCount: 140,
    chart: [
      { label: 'Mon', val: 172, russell: 168, buybacks: 33, dividends: 59, capex: 8 },
      { label: 'Tue', val: 175, russell: 170, buybacks: 34, dividends: 58, capex: 8 },
      { label: 'Wed', val: 174, russell: 169, buybacks: 34, dividends: 58, capex: 8 },
      { label: 'Thu', val: 179, russell: 172, buybacks: 34, dividends: 58, capex: 8 },
      { label: 'Fri', val: 182.4, russell: 174, buybacks: 34.2, dividends: 58.1, capex: 7.7 },
    ]
  },
  Monthly: {
    buybacksPct: 35.1, buybacksAmt: '$64.6B', buybacksMedian: 30, buybacksYoy: '+2.4%',
    dividendsPct: 57.0, dividendsAmt: '$104.9B', dividendsMedian: 50, dividendsYoy: '-1.1%',
    capexPct: 7.9, capexAmt: '$14.5B', capexMedian: 12, capexYoy: '+0.8%',
    buybacksCount: 212, dividendsCount: 135, capexCount: 144,
    chart: [
      { label: 'Jan', val: 120, russell: 115, buybacks: 40, dividends: 30, capex: 30 },
      { label: 'Feb', val: 135, russell: 125, buybacks: 45, dividends: 28, capex: 27 },
      { label: 'Mar', val: 128, russell: 122, buybacks: 42, dividends: 32, capex: 26 },
      { label: 'Apr', val: 155, russell: 140, buybacks: 50, dividends: 25, capex: 25 },
      { label: 'May', val: 142, russell: 135, buybacks: 44, dividends: 29, capex: 27 },
      { label: 'Jun', val: 168, russell: 152, buybacks: 55, dividends: 22, capex: 23 },
      { label: 'Jul', val: 160, russell: 148, buybacks: 52, dividends: 24, capex: 24 },
      { label: 'Aug', val: 184, russell: 165, buybacks: 60, dividends: 20, capex: 20 },
      { label: 'Sep', val: 175, russell: 160, buybacks: 56, dividends: 22, capex: 22 },
      { label: 'Oct', val: 192, russell: 172, buybacks: 65, dividends: 18, capex: 17 },
      { label: 'Nov', val: 188, russell: 170, buybacks: 62, dividends: 19, capex: 19 },
      { label: 'Dec', val: 205, russell: 185, buybacks: 70, dividends: 15, capex: 15 },
    ]
  },
  Yearly: {
    buybacksPct: 38.5, buybacksAmt: '$81.0B', buybacksMedian: 30, buybacksYoy: '+5.2%',
    dividendsPct: 51.2, dividendsAmt: '$107.7B', dividendsMedian: 50, dividendsYoy: '-3.4%',
    capexPct: 10.3, capexAmt: '$21.8B', capexMedian: 12, capexYoy: '+2.1%',
    buybacksCount: 245, dividendsCount: 142, capexCount: 160,
    chart: [
      { label: '2020', val: 95, russell: 90, buybacks: 25, dividends: 65, capex: 10 },
      { label: '2021', val: 140, russell: 130, buybacks: 30, dividends: 60, capex: 10 },
      { label: '2022', val: 115, russell: 110, buybacks: 32, dividends: 58, capex: 10 },
      { label: '2023', val: 138, russell: 125, buybacks: 34, dividends: 55, capex: 11 },
      { label: '2024', val: 162, russell: 148, buybacks: 36, dividends: 53, capex: 11 },
      { label: '2025', val: 178, russell: 162, buybacks: 37, dividends: 52, capex: 11 },
      { label: '2026', val: 210.5, russell: 190, buybacks: 38.5, dividends: 51.2, capex: 10.3 },
    ]
  }
};

const CustomFloatingTooltip = ({ active, payload, label, showBenchmark }) => {
  if (active && payload && payload.length) {
    const primary = payload[0];
    const bench = payload.find(p => p.dataKey === 'russellVal');
    return (
      <div style={{
        background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
        padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        minWidth: '170px', color: 'var(--ws-text)'
      }}>
        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginBottom: '4px' }}>{label}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--ws-accent)' }}>${primary.value}B</span>
            <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', background: 'rgba(20, 184, 166, 0.15)', color: 'var(--ws-accent)', border: '1px solid rgba(20, 184, 166, 0.3)' }}>Universe</span>
          </div>
          {showBenchmark && bench && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>${bench.value}B</span>
              <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Russell 2000</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function PerformanceAreaChart({ totalUniverseCap }) {
  const [timeFilter, setTimeFilter] = useState('Monthly');
  const [selectedMetric, setSelectedMetric] = useState('marketCap');
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [activeStrategyFilter, setActiveStrategyFilter] = useState('all');

  const metricMeta = METRIC_CONFIG[selectedMetric] || METRIC_CONFIG.marketCap;

  const currentData = useMemo(() => {
    const base = TIMEFRAME_DATA[timeFilter] || TIMEFRAME_DATA.Monthly;
    const mult = metricMeta.multiplier;

    let mainVal = base.totalCapital || metricMeta.mainVal;
    if (selectedMetric === 'marketCap' && totalUniverseCap && timeFilter === 'Monthly') {
      mainVal = totalUniverseCap;
    } else if (selectedMetric === 'revenue') {
      mainVal = '$92.40B';
    } else if (selectedMetric === 'fcf') {
      mainVal = '$14.80B';
    }

    const scaledChart = base.chart.map(item => ({
      ...item,
      scaledVal: Number((item.val * mult).toFixed(2)),
      russellVal: Number((item.russell * mult).toFixed(2)),
    }));

    return {
      ...base,
      mainVal,
      chart: scaledChart
    };
  }, [timeFilter, selectedMetric, totalUniverseCap, metricMeta]);

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', boxSizing: 'border-box'
    }}>
      {/* Top Header & Metric Switcher Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
              TARGET CAPITAL BREAKDOWN
            </span>

            {/* Metric Switcher (Market Cap | Revenue | FCF) */}
            <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)' }}>
              {['marketCap', 'revenue', 'fcf'].map(mKey => (
                <button
                  key={mKey}
                  onClick={() => setSelectedMetric(mKey)}
                  style={{
                    background: selectedMetric === mKey ? 'var(--ws-accent)' : 'transparent',
                    color: selectedMetric === mKey ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
                    border: 'none', padding: '2px 8px', fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {METRIC_CONFIG[mKey].label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--ws-text)', lineHeight: 1 }}>
              {currentData.mainVal}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>
              {metricMeta.subLabel} ({timeFilter})
            </span>
          </div>
        </div>

        {/* Right Controls: Benchmark Toggle & Time Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Benchmark Overlay Toggle */}
          <button
            onClick={() => setShowBenchmark(prev => !prev)}
            style={{
              background: showBenchmark ? 'rgba(245, 158, 11, 0.15)' : 'var(--ws-bg-2)',
              color: showBenchmark ? '#f59e0b' : 'var(--ws-text-3)',
              border: showBenchmark ? '1px solid #f59e0b' : '1px solid var(--ws-border)',
              padding: '4px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', outline: 'none'
            }}
          >
            {showBenchmark ? '● vs Russell 2000' : '+ Compare Russell 2000'}
          </button>

          {/* Time Filter Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--ws-bg-2)', padding: '3px', border: '1px solid var(--ws-border)' }}>
            {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(t => (
              <button key={t} onClick={() => setTimeFilter(t)} style={{
                background: timeFilter === t ? 'var(--ws-accent)' : 'transparent',
                color: timeFilter === t ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
                border: 'none', padding: '4px 12px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Solid Clean Capital Strategy Progress Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--ws-border)', borderBottom: '1px solid var(--ws-border)' }}>
        
        {/* Share Buybacks */}
        <div
          onClick={() => setActiveStrategyFilter(activeStrategyFilter === 'buybacks' ? 'all' : 'buybacks')}
          style={{
            padding: '4px 8px', cursor: 'pointer',
            background: activeStrategyFilter === 'buybacks' ? 'var(--ws-bg-2)' : 'transparent',
            border: activeStrategyFilter === 'buybacks' ? '1px solid var(--ws-accent)' : '1px solid transparent'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-2)' }}>Share Buybacks</span>
            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-accent)', fontFamily: "'JetBrains Mono', monospace" }}>
              {currentData.buybacksYoy} YoY
            </span>
          </div>
          <div style={{ position: 'relative', height: '6px', width: '100%', background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${currentData.buybacksPct}%`,
              background: 'var(--ws-accent)',
              transition: 'width 0.4s ease'
            }} />
            {/* Sector Median Benchmark Line */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${currentData.buybacksMedian}%`,
              width: '2px', background: '#f59e0b', zIndex: 2
            }} title={`Sector Median: ${currentData.buybacksMedian}%`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            <span>{currentData.buybacksPct}% · {currentData.buybacksAmt}</span>
            <span style={{ color: '#f59e0b' }}>Median {currentData.buybacksMedian}%</span>
          </div>
        </div>

        {/* Dividends */}
        <div
          onClick={() => setActiveStrategyFilter(activeStrategyFilter === 'dividends' ? 'all' : 'dividends')}
          style={{
            padding: '4px 8px', cursor: 'pointer',
            background: activeStrategyFilter === 'dividends' ? 'var(--ws-bg-2)' : 'transparent',
            border: activeStrategyFilter === 'dividends' ? '1px solid #f59e0b' : '1px solid transparent'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-2)' }}>Dividends</span>
            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-red)', fontFamily: "'JetBrains Mono', monospace" }}>
              {currentData.dividendsYoy} YoY
            </span>
          </div>
          <div style={{ position: 'relative', height: '6px', width: '100%', background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${currentData.dividendsPct}%`,
              background: '#f59e0b',
              transition: 'width 0.4s ease'
            }} />
            {/* Sector Median Benchmark Line */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${currentData.dividendsMedian}%`,
              width: '2px', background: '#f59e0b', zIndex: 2
            }} title={`Sector Median: ${currentData.dividendsMedian}%`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            <span>{currentData.dividendsPct}% · {currentData.dividendsAmt}</span>
            <span style={{ color: '#f59e0b' }}>Median {currentData.dividendsMedian}%</span>
          </div>
        </div>

        {/* CapEx & R&D */}
        <div
          onClick={() => setActiveStrategyFilter(activeStrategyFilter === 'capex' ? 'all' : 'capex')}
          style={{
            padding: '4px 8px', cursor: 'pointer',
            background: activeStrategyFilter === 'capex' ? 'var(--ws-bg-2)' : 'transparent',
            border: activeStrategyFilter === 'capex' ? '1px solid #a855f7' : '1px solid transparent'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-2)' }}>CapEx & R&D</span>
            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-accent)', fontFamily: "'JetBrains Mono', monospace" }}>
              {currentData.capexYoy} YoY
            </span>
          </div>
          <div style={{ position: 'relative', height: '6px', width: '100%', background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${currentData.capexPct}%`,
              background: '#a855f7',
              transition: 'width 0.4s ease'
            }} />
            {/* Sector Median Benchmark Line */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${currentData.capexMedian}%`,
              width: '2px', background: '#f59e0b', zIndex: 2
            }} title={`Sector Median: ${currentData.capexMedian}%`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            <span>{currentData.capexPct}% · {currentData.capexAmt}</span>
            <span style={{ color: '#f59e0b' }}>Median {currentData.capexMedian}%</span>
          </div>
        </div>
      </div>

      {/* Smooth Area Chart with Dual Benchmark Overlay */}
      <div style={{ width: '100%', flex: 1, minHeight: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={currentData.chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--ws-accent)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--ws-accent)" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorRussell" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ws-text-3)' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ws-text-3)' }} />
            <Tooltip content={<CustomFloatingTooltip showBenchmark={showBenchmark} />} />
            <Area
              type="monotone"
              dataKey="scaledVal"
              name="Universe"
              stroke="var(--ws-accent)"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorVal)"
              activeDot={{ r: 6, fill: 'var(--ws-bg-1)', stroke: 'var(--ws-accent)', strokeWidth: 2 }}
            />
            {showBenchmark && (
              <Area
                type="monotone"
                dataKey="russellVal"
                name="Russell 2000"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorRussell)"
                activeDot={{ r: 5, fill: 'var(--ws-bg-1)', stroke: '#f59e0b', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Breakdown */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: '8px', paddingTop: '10px', borderTop: '1px solid var(--ws-border)', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', background: 'var(--ws-accent)' }} />
          <span style={{ color: 'var(--ws-text-2)' }}>Buybacks:</span>
          <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{currentData.buybacksPct}% ({currentData.buybacksCount} stocks)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', background: '#f59e0b' }} />
          <span style={{ color: 'var(--ws-text-2)' }}>Dividends:</span>
          <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{currentData.dividendsPct}% ({currentData.dividendsCount} stocks)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', background: '#a855f7' }} />
          <span style={{ color: 'var(--ws-text-2)' }}>CapEx:</span>
          <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{currentData.capexPct}% ({currentData.capexCount} stocks)</span>
        </div>
      </div>
    </div>
  );
}
