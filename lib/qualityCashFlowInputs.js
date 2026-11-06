import {samePeriod,validPeriod} from './financialIntegrity.js';
import {periodRelation} from './financialDataPolicy.js';

const finite=Number.isFinite;
const labels={revVal:'ingresos',niVal:'beneficio neto'};
// Independent, read-only windows for two Quality components. Never replace the
// principal statements, or let administrative priority bypass period matching.
export function qualityCashFlowInputs(data={}){
  const periods=data.financialPeriods||{};
  const metadata=f=>periods[f]||periods[{fcfVal:'fcf',revVal:'rev',niVal:'ni'}[f]];
  const points=f=>[...(data[f.replace(/Val$/,'History')]||[]),{...metadata(f),val:data[f]}];
  const annual=p=>finite(p.val)&&['FY','TTM'].includes(p.basis)&&validPeriod(p)&&p.currency&&p.scope&&p.scope!=='provider-unspecified'&&(!p.unit||p.unit===p.currency)&&(!data.currency||p.currency===data.currency);
  const sorted=p=>p.sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.basis.localeCompare(a.basis));
  function select(denominator){
    const fcf=points('fcfVal').filter(annual),other=points(denominator).filter(annual),sbc=points('sbcVal').filter(annual);
    const pairs=sorted(fcf.flatMap(f=>other.filter(o=>samePeriod(f,o)).map(o=>({...f,other:o}))));
    const latest=pairs[0];
    if(latest){
      const conflicting=(field,p)=>points(field).filter(x=>annual(x)&&samePeriod(x,p)).some(x=>x.val!==p.val);
      if(conflicting('fcfVal',latest)||conflicting(denominator,latest.other))return unavailable('Cifras contradictorias para el mismo periodo completo.',latest,['fcfVal',denominator],'ambiguous');
      const matching=sbc.filter(s=>samePeriod(latest,s));
      if(matching.some(s=>s.val!==matching[0].val))return unavailable('SBC contradictorio para el periodo seleccionado.',latest,['sbcVal'],'ambiguous');
      const inputs={fcfVal:latest.val,[denominator]:latest.other.val,sbcVal:matching[0]?.val??null};
      return {status:'matched',period:latest,inputs,financialPeriods:{fcfVal:latest,[denominator]:latest.other,...(matching[0]?{sbcVal:matching[0]}:{})},reason:null,missing:[],warnings:matching.length?[]:['SBC del mismo periodo N/D: se calcula sin el ajuste opcional de SBC.']};
    }
    const required=['fcfVal',denominator],known=required.filter(f=>finite(data[f]));
    const partial=known.some(f=>['H1','Q','instant'].includes(metadata(f)?.basis));
    const conflict=known.some((a,i)=>known.slice(i+1).some(b=>periodRelation(metadata(a),metadata(b))==='incompatible'));
    // Preserve defensible legacy inputs only when no known partial window or
    // incompatibility exists; absence of provenance is still labelled provisional.
    if(!partial&&!conflict&&!fcf.length&&!other.length){
      const sbcCompatible=!finite(data.sbcVal)||known.every(f=>periodRelation(metadata(f),metadata('sbcVal'))!=='incompatible')&&!['H1','Q','instant'].includes(metadata('sbcVal')?.basis);
      return {status:'legacy',period:null,inputs:{fcfVal:data.fcfVal??null,[denominator]:data[denominator]??null,sbcVal:sbcCompatible?data.sbcVal??null:null},financialPeriods:Object.fromEntries([...required,...(sbcCompatible?['sbcVal']:[])].map(f=>[f,metadata(f)])),reason:null,missing:required.filter(f=>!finite(data[f])),warnings:['Periodo completo no verificable con los metadatos heredados; cálculo provisional.']};
    }
    const anchor=sorted([...fcf])[0]||sorted([...other])[0];
    const missing=anchor?required.filter(f=>!points(f).some(p=>annual(p)&&samePeriod(p,anchor))):required;
    const window=anchor?`${anchor.basis} ${anchor.periodStart}–${anchor.periodEnd} (${anchor.currency}, ${anchor.scope})`:'FY/TTM';
    return unavailable(`Falta ${missing.map(f=>f==='fcfVal'?'FCF':labels[f]).join(' y ')} compatible con ${window}. No se mezclan periodos.`,anchor,missing);
    function unavailable(reason,p,missing,reasonCode='missing-compatible-inputs'){
      return {status:'unavailable',period:p||null,inputs:{fcfVal:null,[denominator]:null,sbcVal:null},financialPeriods:{},reason,reasonCode,missing,warnings:[]};
    }
  }
  return {fcfGeneration:select('revVal'),cashConversion:select('niVal')};
}
