import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import arlo from './__fixtures__/arlo-production-2026-11-06.json';
import {priceRelativeValue} from './currencyPresentation';
import {analyzeStock} from './engine';
import {computeDCFValue,computeEasyMode} from './financialCalculations';

describe('five-year presentation regression',()=>{
 it.each([[2.19,14.75,-0.8515254237],[20,10,1],[5,10,-.5],[10,10,0],[0,10,-1]])('price relative difference %s / %s',(fair,price,expected)=>expect(priceRelativeValue(fair,price)).toBeCloseTo(expected,8));
 it.each([[null,10],[10,null],[-1,10],[10,0],[10,-1],[Infinity,10],[10,NaN]])('rejects invalid values %s / %s',(fair,price)=>expect(priceRelativeValue(fair,price)).toBeNull());
 for(const ticker of ['AAPL','LLOY.L','ALC.MC'])it(`preserves financial results and uses future values for ${ticker}`,()=>{
  const d=JSON.parse(readFileSync(new URL(`./__fixtures__/integrity-baseline/${ticker}.json`,import.meta.url),'utf8'));
  const before=JSON.stringify(d);const e=analyzeStock(d);expect(e.scenarios.status).toBe('ok');for(const s of e.scenarios.scenarios){
   expect(s.cagr).toBeCloseTo((s.valueYear5/d.currentPrice)**(1/5)-1,2);
   priceRelativeValue(s.fairValueToday,d.currentPrice);
  }expect(JSON.stringify(d)).toBe(before);expect(analyzeStock(d)).toEqual(e);
 });
 it('replays actual ARLO data without inventing compatible FCF',()=>{
  const e=analyzeStock(arlo,{now:'2026-11-06'});const legacy=computeDCFValue(arlo,arlo.riskFreeRate);const easy=computeEasyMode(arlo,true);
  expect(arlo.currency).toBe('USD');expect(arlo.fcfVal).toBeNull();expect(arlo.pfcf).toBeNull();expect(legacy).toBeNull();expect(easy.trueFcf).toBeNull();expect(e.scenarios.status).toBe('ok');expect(e.scenarios.scenarios.find(s=>s.key==='central').fairValueToday).toBeCloseTo(1.94,2);
  for(const s of e.scenarios.scenarios)expect(s.cagr).toBeCloseTo((s.valueYear5/arlo.currentPrice)**.2-1,2);
 });
});
