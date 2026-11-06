import {validPeriod,samePeriod} from './financialIntegrity.js';
import {periodRelation} from './financialDataPolicy.js';

// Select inputs only for annual valuation multiples; never rewrite the displayed
// latest statements or reuse this view for quality, DCF or scenarios.
export function valuationCashFlow(data){
  if(!data)return {data,basis:null};
  const periods=data.financialPeriods||{},fcf=periods.fcfVal||periods.fcf,sbc=periods.sbcVal;
  const annual=p=>['FY','TTM'].includes(p?.basis)&&validPeriod(p);
  const partial=p=>['H1','Q','instant'].includes(p?.basis);
  const conflict=Number.isFinite(data.fcfVal)&&Number.isFinite(data.sbcVal)&&periodRelation(fcf,sbc)==='incompatible';
  // Preserve existing usable annual pairs and legacy data without proven conflict.
  if(Number.isFinite(data.fcfVal)&&!partial(fcf)&&!partial(sbc)&&!conflict)return {data,basis:null};
  const point=(field,p)=>({...p,val:data[field]});
  const fcfPoints=[...(data.fcfHistory||[]),point('fcfVal',fcf)],sbcPoints=[...(data.sbcHistory||[]),point('sbcVal',sbc)];
  const scope=[fcf,periods.revVal||periods.rev].find(p=>p?.scope&&p.scope!=='provider-unspecified')?.scope;
  const usable=p=>Number.isFinite(p.val)&&annual(p)&&p.currency&&p.scope&&p.scope!=='provider-unspecified'&&(!p.unit||p.unit===p.currency)&&(!data.currency||p.currency===data.currency)&&(!scope||p.scope===scope);
  const candidates=[];
  for(const f of fcfPoints.filter(usable))for(const s of sbcPoints.filter(usable))if(samePeriod(f,s))candidates.push({f,s});
  candidates.sort((a,b)=>b.f.periodEnd.localeCompare(a.f.periodEnd)||b.f.basis.localeCompare(a.f.basis));
  const latest=candidates[0];
  if(latest){
    // Do not resolve contradictory facts by position, price or resulting score.
    const same=candidates.filter(x=>samePeriod(x.f,latest.f));
    if(same.some(x=>x.f.val!==latest.f.val||x.s.val!==latest.s.val))return excluded('Hay cifras contradictorias para la misma pareja anual de FCF y SBC.');
    const basis={status:'matched',basis:latest.f.basis,periodStart:latest.f.periodStart,periodEnd:latest.f.periodEnd,currency:latest.f.currency,scope:latest.f.scope,fcf:latest.f.val,sbc:latest.s.val,source:'same-period-history',fcfSource:latest.f.source||null,sbcSource:latest.s.source||null};
    return {data:{...data,fcfVal:latest.f.val,sbcVal:latest.s.val,financialPeriods:{...periods,fcfVal:latest.f,sbcVal:latest.s}},basis};
  }
  if(data.manualCalculation?.fields?.some(f=>['fcfVal','sbcVal'].includes(f)))return {data,basis:{status:'manual-unmatched',reason:'Cálculo con entradas manuales sin pareja FY/TTM comparable. Se conservan sus periodos originales, sin anualizarlos.'}};
  if(partial(fcf)||partial(sbc)||conflict)return excluded('No hay una pareja FY/TTM de FCF y SBC con periodo, moneda y perímetro comparables.');
  return {data,basis:null};
  function excluded(reason){return {data:{...data,fcfVal:null,sbcVal:null},basis:{status:'unavailable',reason}};}
}
