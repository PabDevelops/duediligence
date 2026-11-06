import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { currencySymbol, financialAmount, financialText, presentAnalysis } from './currencyPresentation';
import { STATEMENTS, statementRows, periodLabel, growthPoints } from './analysisPresentation';
import { analyzeStock } from './engine';
import { sanitizeFinancialData } from './financialDataPolicy';
import { computeEasyMode, computeDCFValue } from './financialCalculations';
import { getCompanyHeaderScores } from './companyHeaderScores';
import { formatPrice } from './formatters';
import { screenerView } from './screenerView';

const numericTree = value => typeof value === 'number' || value === null ? value : Array.isArray(value) ? value.map(numericTree) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([,v]) => typeof v !== 'string').map(([k,v])=>[k,numericTree(v)])) : typeof value;

describe('company analysis presentation without financial changes', () => {
  for (const ticker of ['ALC.MC','BYTE.MC','RBT.MC','SCO.MC','GRI.MC','ART.MC','AAPL','LLOY.L']) {
    it(`preserves all numeric analysis, grades, scenarios and input data for ${ticker}`, () => {
      const data = sanitizeFinancialData(JSON.parse(readFileSync(new URL(`./__fixtures__/integrity-baseline/${ticker}.json`,import.meta.url),'utf8')));
      const original = structuredClone(data);
      const engine = analyzeStock(data, {now:'2026-11-06'});
      const easy = computeEasyMode(data, true);
      const before = getCompanyHeaderScores(easy, data, engine);
      const dcf = computeDCFValue(data, data.riskFreeRate);
      const presented = presentAnalysis(engine, data);
      expect(numericTree(presented)).toEqual(numericTree(engine));
      expect(getCompanyHeaderScores(easy,data,presented)).toEqual(before);
      expect(presented.scenarios).toBe(engine.scenarios);
      expect(computeDCFValue(data,data.riskFreeRate)).toEqual(dcf);
      expect(data).toEqual(original);
    });
  }

  it('corrects Altia FCF comparison currency without changing amounts or ratings', () => {
    const data = { currency:'EUR', fcfHistory:[{year:'2022',val:4_100_000},{year:'2023',val:10_000_000},{year:'2024',val:20_800_000}] };
    const engine = {signals:{signals:[{id:'fcf_improvement',comparison:'De 4,1 M $ a 20,8 M $.',confidence:'alta'}]}};
    const presented = presentAnalysis(engine,data);
    expect(presented.signals.signals[0].comparison).toBe('De 4,1 M EUR a 20,8 M EUR.');
    expect(engine.signals.signals[0].comparison).toContain('$');
    expect(presented.signals.signals[0].confidence).toBe('alta');
  });

  it.each(['ALC.MC','SAP.DE','SAP.F'])('does not override a provider USD currency using %s suffix',ticker=> {
    expect(financialAmount(100,{currency:'USD'},{ticker,currency:'EUR'})).toEqual({value:100,currency:'USD'});
  });
  it('prioritizes each reported period currency over a conflicting global reporting hint', () => {
    expect(financialAmount(100,{currency:'USD'},{financialCurrency:'EUR',currency:'EUR'})).toEqual({value:100,currency:'USD'});
  });
  it('displays original accounts only when conversion provenance permits reversal', () => {
    const p={currency:'USD',originalCurrency:'EUR',fxRate:1.1};
    expect(financialAmount(110,p,{currency:'USD'})).toEqual({value:expect.closeTo(100),currency:'EUR'});
    expect(financialText(110,p,{currency:'USD'})).toBe('100 EUR');
    expect(financialAmount(110,{...p,fxRate:null},{currency:'USD'}).value).toBeNull();
    expect(financialAmount(110,null,{financialCurrency:'EUR',currency:'USD'}).value).toBeNull();
  });
  it('never invents currency for legacy cache rows', () => {
    expect(financialText(100,null,{ticker:'AAPL'})).toBe('100 moneda N/D');
    expect(currencySymbol(null)).toContain('N/D');
  });
  it('keeps GBP and GBp distinct without converting stored prices', () => {
    expect(formatPrice(96.58,'GBp')).toContain('GBp 96');
    expect(formatPrice(0.9658,'GBP')).toContain('£0');
    expect(currencySymbol('CHF')).toBe('CHF ');
    expect(currencySymbol('CAD')).toBe('CA$');
  });
  it('retains currency in compact screener rows', () => {
    expect(screenerView({currency:'EUR',currentPrice:5.8}).currency).toBe('EUR');
    expect(screenerView({}).currency).toBeNull();
  });

  it('uses explicit EPS history values, not net income stored beside them', () => {
    const d={currency:'EUR',epsHistory:[{year:'2023',val:15_364_689,eps:0.22}]};
    expect(growthPoints(d,'epsHistory')[0].val).toBe(0.22);
    expect(statementRows(d,[['BPA','eps']],true)[0].value).toBe('0,22 EUR');
    expect(growthPoints({epsHistory:[{val:100}]},'epsHistory')[0].val).toBeUndefined();
  });
  it('retains FY, H1, Q and TTM individually, including conflicting same-year observations', () => {
    const points=['FY','H1','Q','TTM'].map((basis,i)=>({basis,year:'2025',periodEnd:'2025-12-31',val:10+i,currency:'EUR',source:'test'}));
    const rows=statementRows({revHistory:points},[['Ingresos','rev']],true);
    expect(rows).toHaveLength(4);
    expect(rows.map(r=>r.period.split(' · ')[0])).toEqual(['FY','H1','Q','TTM']);
    expect(rows.map(r=>r.value)).toEqual(['10 EUR','11 EUR','12 EUR','13 EUR']);
  });
  it('does not silently replace a missing current value with a historical year', () => {
    const rows=statementRows({revHistory:[{val:123,year:'2020'}]},[['Ingresos','rev']],false);
    expect(rows[0].value).toBe('N/D');
    expect(rows[0].status).toBe('Ausente');
    expect(periodLabel({year:'2020',basis:'FY'})).toContain('fecha exacta N/D');
  });
  it('preserves distinct source, perimeter and currency per statement observation', () => {
    const rows=statementRows({revHistory:[{val:100,basis:'FY',year:'2024',source:'SEC',scope:'consolidated',currency:'USD'},{val:90,basis:'H1',year:'2024',source:'Yahoo',scope:'parent',currency:'EUR'}]},[['Ingresos','rev']],true);
    expect(rows[0]).toMatchObject({source:'SEC',scope:'consolidated',value:'100 USD'});
    expect(rows[1]).toMatchObject({source:'Yahoo',scope:'parent',value:'90 EUR'});
  });
  it('distinguishes blocked data from missing data and retains its explanation', () => {
    const rows = statementRows({niVal:null,financialIntegrity:{fields:{niVal:{status:'blocked',reason:'Periodos incompatibles'}}}},[['Beneficio neto','ni']],false);
    expect(rows[0]).toMatchObject({value:'N/D',status:'Incompatible',reason:'Periodos incompatibles'});
  });
  it('provides all available statement groups and does not substitute OCF for missing FCF/CAPEX', () => {
    const fields=STATEMENTS.find(([name])=>name==='Flujos de caja')[1];
    const rows=statementRows({currency:'EUR',operatingCFVal:100},fields,false);
    expect(rows.find(r=>r.label==='Flujo operativo (OCF)').value).toBe('100 EUR');
    expect(rows.find(r=>r.label==='CAPEX').value).toBe('N/D');
    expect(rows.find(r=>r.label==='Flujo de caja libre (FCF)').value).toBe('N/D');
  });
});
