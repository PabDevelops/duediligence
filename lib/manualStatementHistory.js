import {STATEMENTS} from './analysisPresentation';
import {HISTORY_FIELDS} from './financialIntegrity';
import {parseFiscalDateInput} from './fiscalDateInput';
import {validateFinancialOverride,financialOverrideStorageTarget} from './financialOverrides';

export function historicalStatementFields(statement){
  if(!['Resultados','Balance'].includes(statement))return [];
  return STATEMENTS.find(([title])=>title===statement)[1]
    .filter(([,key])=>HISTORY_FIELDS[`${key}History`])
    .map(([label,key])=>({label:key==='shares'?'Acciones medias (base del BPA)':label,key,history:`${key}History`,shares:key.startsWith('shares')}));
}

// Validate the entire form before sending any existing, version-protected writes.
// Empty cells are omissions, never implicit zeros or deletions.
export function prepareStatementHistory({ticker,statement,year,values,metadata={},factor=1,rows=[]}){
  const fields=historicalStatementFields(statement);
  if(!fields.length)throw new Error('Estado financiero no válido.');
  const documented=text=>parseFiscalDateInput(text||'')??String(text||'').trim();
  const periodEnd=documented(metadata.periodEnd),exercise=String(year||periodEnd.match(/^\d{4}-\d{2}-\d{2}$/)?.[0]?.slice(0,4)||'');
  if(!/^\d{4}$/.test(exercise))throw new Error('Indica el ejercicio o una fecha de cierre completa.');
  if(![1,1000,1000000].includes(Number(factor)))throw new Error('Unidades no válidas.');
  const quarterly=(metadata.historyBasis||metadata.basis)==='Q';
  const ttm=(metadata.historyBasis||metadata.basis)==='TTM';
  if(ttm&&statement==='Balance')throw new Error('El balance es un saldo a una fecha, no un periodo TTM.');
  if(quarterly&&!/^\d{4}$/.test(String(year||'')))throw new Error('Indica el ejercicio fiscal del trimestre; no se deduce de la fecha de cierre.');
  if(quarterly&&!/^Q[1-4]$/.test(metadata.fiscalQuarter||''))throw new Error('Selecciona el trimestre fiscal (Q1–Q4).');
  const common={...metadata,basis:statement==='Balance'?'instant':quarterly?'Q':ttm?'TTM':'FY',fiscalQuarter:quarterly?metadata.fiscalQuarter:undefined,periodStart:statement==='Balance'?'':documented(metadata.periodStart),periodEnd};
  const writes=[];
  for(const f of fields){
    const text=String(values[f.key]??'').trim().replace(',','.');
    if(!text)continue;
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))throw new Error(`${f.label}: usa un número sin separadores de miles.`);
    const target=financialOverrideStorageTarget(`history:${f.history}:${exercise}${quarterly?`:${metadata.fiscalQuarter}`:''}`,common),value=Number(text)*(f.shares?1:Number(factor));
    const body={ticker,target,value,metadata:common,expectedId:rows.find(r=>r.target===target)?.id||0};
    const error=validateFinancialOverride(body);
    if(error)throw new Error(`${f.label}: ${error}`);
    writes.push({label:f.label,body});
  }
  if(!writes.length)throw new Error('Introduce al menos una cifra. Las casillas vacías no modifican datos.');
  return writes;
}

// Reuse individual revisions and optimistic locking. A failed request stops the
// sequence and reports precisely what was saved; retry skips those exact writes.
export async function saveStatementHistory(writes,{send,completed=new Map(),onProgress=()=>{}}){
  const saved=[];
  for(const write of writes){
    const signature=JSON.stringify({value:write.body.value,metadata:write.body.metadata});
    const previous=completed.get(write.body.target);
    if(previous?.signature===signature){saved.push(write.label);continue;}
    const body={...write.body,expectedId:previous?.id??write.body.expectedId};
    try{
      const result=await send(body);
      completed.set(body.target,{id:result.id,signature});saved.push(write.label);
      onProgress(saved.length,writes.length);
    }catch(error){return {ok:false,saved,failed:write.label,error:error.message||'No se pudo guardar.'};}
  }
  return {ok:true,saved};
}
