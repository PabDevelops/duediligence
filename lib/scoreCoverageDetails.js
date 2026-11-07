// Presentation diagnostics only: the score, weights and availability come from
// the existing scoring result. Never infer a score from these descriptions.
import {valuationCashFlow} from './valuationCashFlow';
import {normalizeInput} from './engine/input';
import {qualityCashFlowInputs} from './qualityCashFlowInputs';
import {growthQuarterlyRevenue} from './growthQuarterlyRevenue';
import {scopeFinancialEntity} from './listingIdentity';

const names={revVal:'Ingresos',oiVal:'EBIT',niVal:'Beneficio neto',fcfVal:'FCF',sbcVal:'SBC',roic:'ROIC',roe:'ROE',roa:'ROA',opMargin:'Margen operativo',netMargin:'Margen neto',marketCap:'Capitalización',priceToBook:'Precio/valor contable',equityVal:'Patrimonio neto',debtVal:'Deuda',cashVal:'Caja',daVal:'Amortizaciones',interestVal:'Intereses',currentAssetsVal:'Activo corriente',currentLiabilitiesVal:'Pasivo corriente',revGrowth:'Crecimiento de ingresos',revHistory:'Histórico de ingresos',oiHistory:'Histórico de EBIT',fcfHistory:'Histórico de FCF',niHistory:'Histórico de beneficio',sharesHistory:'Histórico de acciones diluidas'};
const finite=Number.isFinite;
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.split('-').reverse().join('/'):s;
function period(p){
  if(!p)return 'Periodo no documentado';
  return [p.basis||'Tipo no documentado',p.periodStart&&p.periodEnd?`${date(p.periodStart)}–${date(p.periodEnd)}`:p.periodEnd?date(p.periodEnd):'fechas no documentadas',p.currency,p.scope].filter(Boolean).join(' · ');
}
export function scoreCoverageDetails(score,data={},analysis){
  data=scopeFinancialEntity(data);
  const qualityInput=normalizeInput(data,{integrityPurpose:'quality'});
  const financial=analysis?.profile?.kind==='financial'||score.components.some(c=>c.id==='roa')||score.components.some(c=>c.label?.includes('ROE'));
  const selected=valuationCashFlow(data);
  const cashSelections=analysis?.quality?.cashFlowInputs||qualityCashFlowInputs(data);
  const quarterlyRevenue=growthQuarterlyRevenue(data);
  const specs={
    currentRevenue:[finite(data.revGrowth)?['revGrowth']:['revHistory'],'Introduce crecimiento de ingresos con su periodo o ingresos de dos ejercicios consecutivos comparables.'],
    historicalRevenue:[['revHistory'],'Añade ingresos positivos de al menos tres ejercicios comparables. Se utiliza la ventana reciente de hasta cuatro observaciones, excluyendo años anómalos según la metodología actual.'],
    acceleration:[['revHistory'],'Añade tres ejercicios consecutivos de ingresos, o dos trimestres consecutivos con sus mismos trimestres del ejercicio anterior, en fechas, unidades, moneda y perímetro comparables. Se comparan dos crecimientos interanuales; no se anualizan trimestres.'],
    cashEvolution:[financial?['revHistory','niHistory','sharesHistory']:['revHistory','fcfHistory'],financial?'Añade ingresos, beneficio y acciones diluidas de dos ejercicios consecutivos coincidentes.':'Añade ingresos y FCF de dos ejercicios consecutivos coincidentes. FCF aislado no basta.'],
    pfcf:[['marketCap','fcfVal',...(selected.data?.sbcVal!=null?['sbcVal']:[])],'Introduce FCF y capitalización. Añade SBC del mismo periodo para contrastar la caja después de SBC. No se puntúa este múltiplo si su denominador no es positivo.'],
    pe:[['marketCap','niVal'],'Introduce capitalización y beneficio neto positivo comparable. Un beneficio negativo no permite calcular P/E.'],
    pb:[['priceToBook','equityVal'],'Introduce precio/valor contable y patrimonio neto positivo.'],
    evEbit:[['marketCap','debtVal','cashVal','oiVal'],'Completa EBIT, capitalización, deuda y caja. En negocios cíclicos también se necesita el histórico para normalizar el EBIT.'],
    evEbitda:[['marketCap','debtVal','cashVal','oiVal','daVal'],'Completa EBIT, amortizaciones, capitalización, deuda y caja.'],
    returns:[[financial?'roe':'roic'],financial?'Introduce ROE de su periodo. El ROE automático requiere patrimonio neto positivo.':'Introduce ROIC de su periodo; se compara con el coste del capital existente.'],
    roa:[['roa'],'Introduce ROA, documentando el periodo y si está anualizado. No se anualiza automáticamente.'],
    operatingMargin:[[financial?'netMargin':'opMargin'],financial?'Introduce margen neto o beneficio e ingresos comparables.':'Introduce margen operativo o EBIT e ingresos comparables.'],
    fcfGeneration:[['fcfVal','revVal',...(data.sbcVal!=null?['sbcVal']:[])],'Introduce FCF e ingresos distintos de cero, del mismo periodo. SBC permite contrastar el ajuste adicional.'],
    cashConversion:[['fcfVal','niVal',...(data.sbcVal!=null?['sbcVal']:[])],'Introduce FCF y beneficio neto positivo comparable. Con pérdidas, esta conversión no es medible.'],
    marginStability:[['revHistory','oiHistory'],'Añade al menos cuatro ejercicios coincidentes con ingresos positivos y EBIT.'],
    balance:[['debtVal','cashVal','oiVal','daVal','interestVal','currentAssetsVal','currentLiabilitiesVal'],'No hacen falta todas las alternativas: deuda/caja y EBITDA, EBIT e intereses positivos, o activo y pasivo corriente positivos (según el perfil).'],
  };
  return score.components.map(c=>{
    let [fields,action]=specs[c.id]||[[], 'Consulta las advertencias de este indicador.'];
    if(c.evaluation)fields=c.evaluation.fields;
    if(c.id==='balance'&&finite(c.score)){
      const inp=qualityInput,used=[];
      if(finite(inp.netDebt)&&(inp.ebitda>0||inp.netDebt<=0||finite(inp.ebitda)&&inp.ebitda<=0&&inp.netDebt>0)){
        used.push('debtVal','cashVal');if(inp.ebitda>0||inp.netDebt>0)used.push('oiVal','daVal');
      }
      if(finite(inp.oi)&&inp.interest>0)used.push('oiVal','interestVal');
      if(!financial&&analysis?.profile?.kind!=='reit'&&finite(inp.currentAssets)&&inp.currentLiabilities>0)used.push('currentAssetsVal','currentLiabilitiesVal');
      if(used.length)fields=[...new Set(used)];
    }
    const cashSelection=['fcfGeneration','cashConversion'].includes(c.id)?cashSelections[c.id]:null;
    const source=cashSelection?{...data,...cashSelection.inputs,financialPeriods:cashSelection.financialPeriods}:c.id==='pfcf'?selected.data:data;
    if(cashSelection)fields=['fcfVal',c.id==='fcfGeneration'?'revVal':'niVal',...(finite(source.sbcVal)?['sbcVal']:[])];
    const quarterlyUsed=c.id==='acceleration'&&quarterlyRevenue.acceleration!=null;
    const manual=quarterlyUsed?quarterlyRevenue.records.some(r=>r.used&&r.point.manual):fields.some(f=>data.manualCalculation?.fields?.includes(f)||source?.financialPeriods?.[f]?.manual||Array.isArray(source?.[f])&&source[f].some(p=>p.manual));
    const available=finite(c.score);
    const issues=fields.flatMap(f=>{
      const integrity=source?.financialIntegrity?.fields?.[f];
      return integrity?.modelExcluded||integrity?.status==='incompatible'?[integrity.reason||`${names[f]||f}: incompatible`]:[];
    });
    if(!available&&data.entityComparability?.warning)issues.push(data.entityComparability.warning);
    const calculation=source?.financialIntegrity?.calculations?.[{operatingMargin:financial?'netMargin':'opMargin',fcfGeneration:'fcfMargin',cashConversion:'cashConversion',returns:financial?'roe':'roic',roa:'roa'}[c.id]];
    if(!cashSelection&&calculation?.status==='blocked'&&calculation.reasonCode!=='missing-components'&&calculation.reason)issues.push(calculation.reason);
    if(c.id==='pfcf'&&selected.basis?.status==='unavailable')issues.push(selected.basis.reason);
    const rejectedMethod=analysis?.valuation?.discarded?.find(m=>(m.id||m.method)===c.id);
    const domain=c.id==='cashConversion'&&finite(source?.niVal)&&source.niVal<=0?'El beneficio neto no es positivo.'
      :c.id==='pe'&&finite(source?.niVal)&&source.niVal<=0?'El beneficio neto no es positivo.'
        :c.id==='pfcf'&&finite(source?.fcfVal)&&source.fcfVal-(source.sbcVal??0)<=0?'El FCF después del ajuste disponible de SBC no es positivo.':null;
    const missing=fields.filter(f=>f.endsWith('History')?!(source?.[f]?.some(p=>finite(p.val))):!finite(source?.[f]));
    const discarded=!available&&(cashSelection?.reasonCode==='ambiguous'||issues.length>0||domain||rejectedMethod||score.id==='value'&&analysis?.validation?.hasErrors);
    const status=c.evaluation?.state==='negative-results'?`Evaluado · resultado negativo${manual?' · entrada manual':''}`:available?(manual?'Calculado · entrada manual':'Calculado'):discarded?'Descartado':'Falta información';
    const inputs=fields.map(f=>{
      const h=source?.[f];
      const points=Array.isArray(h)?h.filter(p=>finite(p.val)):null;
      return {field:f,label:(names[f]||f)+(quarterlyUsed?' · Disponible, no utilizado para esta aceleración trimestral':''),period:points?points.map(p=>`${p.year||''}: ${period(p)}`).join('; ')||'Sin histórico':f==='marketCap'?'Dato de mercado actual':period(source?.financialPeriods?.[f]),available:points?points.length>0:finite(h)};
    });
    if(c.id==='pe'&&c.evaluation?.earningsBasis){
      const e=c.evaluation.earningsBasis;
      inputs.push({field:'reported-pe',label:`P/E contable: ${e.reportedPe!=null?e.reportedPe.toLocaleString('es-ES',{maximumFractionDigits:2})+'x':'N/D'}; no equivale a un P/E recurrente`,period:period(e.period),available:e.reportedPe!=null});
      for(const r of e.adjustments)inputs.push({field:`earnings-adjustment:${r.id}`,label:`${({'asset-sale':'Venta de activos','business-sale':'Venta de negocios','discontinued-operations':'Operaciones interrumpidas'})[r.category]||'Partida especial'}: importe identificado ${finite(r.incomeEffect)?r.incomeEffect.toLocaleString('es-ES'):'N/D'} ${r.currency||''} · ${r.source}`,period:`${period(r)} · Efecto neto de impuestos: ${finite(r.afterTaxEffect)?r.afterTaxEffect.toLocaleString('es-ES'):finite(r.taxEffect)?(r.incomeEffect-r.taxEffect).toLocaleString('es-ES'):'N/D'} · Fuente: ${r.sourceUrl||'N/D'}`,available:finite(r.incomeEffect)});
    }
    if(['acceleration','historicalRevenue'].includes(c.id))for(const [i,r] of quarterlyRevenue.records.entries()){
      const used=quarterlyUsed&&r.used;
      inputs.push({field:`quarterly-revenue-${i}`,label:`Ingresos ${r.label} · ${Number.isFinite(r.point.val)?r.point.val.toLocaleString('es-ES'):'N/D'} ${r.point.unit||'unidad N/D'} · ${used?'Utilizado':r.discarded?'Descartado':r.reason.startsWith('Disponible')?'Disponible, no utilizado':'No utilizado'}`,
        available:true,period:`${period(r.point)} · Fuente: ${r.point.source||'no documentada'} · ${c.id==='historicalRevenue'?'No utilizado: la mediana exige ejercicios FY positivos; los Q no sustituyen años completos.':r.reason}`});
    }
    let reason=available?(typeof c.detail==='number'?`${c.detail.toLocaleString('es-ES')}x`:c.detail||'Componente calculado con las entradas disponibles.')
      :cashSelection?.reason||domain||issues.join(' ')||rejectedMethod?.reason||(score.id==='value'&&analysis?.validation?.hasErrors?'La validación del análisis bloquea la valoración. Consulta sus advertencias.':missing.length?`Faltan: ${missing.map(f=>names[f]||f).join(', ')}.`:'Las entradas disponibles no cumplen los requisitos de este componente (histórico, signo, referencia sectorial o comparabilidad).');
    if(!available&&c.id==='marginStability'){
      const years=(data.revHistory||[]).filter(p=>p.val>0&&(data.oiHistory||[]).some(o=>String(o.year)===String(p.year)&&finite(o.val))).map(p=>p.year);
      reason+=` Ejercicios coincidentes disponibles: ${years.join(', ')||'ninguno'}; se requieren al menos cuatro.`;
    }
    if(c.id==='acceleration'&&!quarterlyUsed&&quarterlyRevenue.records.length)reason+=` Serie trimestral: ${quarterlyRevenue.reason}`;
    if(c.id==='historicalRevenue')reason+=` Ejercicios con ingresos positivos disponibles: ${(data.revHistory||[]).filter(p=>p.val>0).map(p=>p.year).join(', ')||'ninguno'}. Los ingresos cero no permiten calcular crecimiento con ese año como denominador.`;
    if(c.evaluation)reason=c.evaluation.reason;
    const snapshots=analysis?.momentum?.snapshots||[],last=snapshots.at(-1),previous=snapshots.at(-2);
    const periodUsed=!available?'No utilizado':c.id==='currentRevenue'&&!finite(data.revGrowth)||c.id==='cashEvolution'?last?`${last.basis} · comparación de ${last.period} con su periodo anterior de referencia`:'Periodo no documentado'
      :c.id==='acceleration'?quarterlyUsed?`Trimestral interanual · ${quarterlyRevenue.periodUsed}`:`${previous?.basis||''} · variaciones de ${previous?.period||'N/D'} y ${last?.period||'N/D'}`
        :fields.some(f=>f.endsWith('History'))?'Serie histórica: ejercicios y fechas en el detalle de entradas'
          :[...new Set(inputs.filter(i=>i.available&&i.field!=='marketCap').map(i=>i.period))].join(' / ')||'Periodo no documentado';
    const warnings=[...(cashSelection?.warnings||[]),...(available&&manual?[...issues,...(data.manualCalculation?.warnings||[]).filter(w=>fields.includes(w.field)).map(w=>w.message)]:[])];
    return {...c,status,manual,inputs,reason,periodUsed,warnings:[...new Set(warnings)],action:available?null:c.evaluation?.reason||cashSelection?.reason||action,discarded};
  });
}
