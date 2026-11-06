// Only the authenticated administration store enables this adapter. It never
// changes formulas: raw manual numbers replace validation-masked inputs, with
// their actual metadata and explicit warnings preserved.
export function authoritativeManualInputs(result,raw,annotations,changed){
  const fields=new Set(changed),warnings=[];
  for(const r of annotations){
    const history=/^history:([^:]+):(\d{4})$/.exec(r.target);
    if(history){
      if(['H1','Q','TTM'].includes(r.period?.basis))continue;
      const [,key,year]=history;
      const existing=(result[key]||[]).find(p=>String(p.year)===year&&p.val===r.value);
      result[key]=(result[key]||[]).filter(p=>String(p.year)!==year);
      if(r.value!=null)result[key].push({...existing,...r.period,year,val:r.value,manual:true});
      result[key].sort((a,b)=>String(a.year).localeCompare(String(b.year)));
      fields.add(key);
      if(raw.financialPeriods?.[r.field]?.periodEnd===r.period?.periodEnd&&raw.financialPeriods?.[r.field]?.periodStart===r.period?.periodStart&&r.period?.periodEnd){result[r.field]=r.value;fields.add(r.field);}
    }else{
      result[r.field]=r.value;fields.add(r.field);
      result.financialPeriods={...result.financialPeriods,[r.field]:r.period};
    }
    const reason=r.reason||r.exclusion||result.financialIntegrity?.fields?.[r.field]?.reason;
    if(reason)warnings.push({field:r.field,target:r.target,message:reason});
    r.modelExcluded=false;r.calculationStatus=r.value==null?'missing':'manual';r.manualCalculation=true;
    r.reason=reason||'Entrada manual de administración; no implica verificación automática.';
  }
  const explicit=new Set(annotations.filter(r=>!r.target.startsWith('history:')).map(r=>r.field));
  for(const field of changed)if(!explicit.has(field)&&raw[field]!==undefined)result[field]=raw[field];
  for(const field of fields){
    if(field.endsWith('History'))continue;
    result.financialIntegrity.fields[field]={...result.financialIntegrity.fields[field],status:'provisional',manual:true,manualCalculation:true,modelExcluded:false};
  }
  const groups={dcf:['fcfVal','sbcVal','revVal','debtVal','cashVal','sharesVal','sharesOutstanding'],projections:['revVal','oiVal','assetsVal','currentLiabilitiesVal','debtVal','cashVal','ebtVal','taxVal','sharesOutstanding'],bankProjections:['niVal','equityVal'],growth:['revGrowth','revHistory','fcfHistory','epsCagr'],value:['fcfVal','sbcVal','pe','roic','oiVal','debtVal','cashVal','fcfHistory','sbcHistory'],quality:['roic','grossMargin','opMargin','roe','roa','fcfVal','debtVal','cashVal','equityVal','currentAssetsVal','currentLiabilitiesVal','niVal']};
  for(const [name,c] of Object.entries(result.financialIntegrity.calculations||{}))if(fields.has(name)||(c.dependencies||groups[name]||[]).some(f=>fields.has(f)))result.financialIntegrity.calculations[name]={...c,status:'provisional',manualCalculation:true};
  result.manualCalculation={fields:[...fields],warnings,message:'Calculado con entradas manuales de administración. Las discrepancias son advertencias; no constituyen una verificación automática ni una anualización.'};
  result.financialIntegrity.status='provisional';
  result.financialIntegrity.issues.push({code:'MANUAL_CALCULATION',severity:'warning',field:'financials',message:result.manualCalculation.message});
  return result;
}

export function manualValidation(validation,data){
  const manual=new Set(data?.manualCalculation?.fields||[]);
  if(!manual.size)return validation;
  const aliases={rev:'revVal',oi:'oiVal',ni:'niVal',gp:'gpVal',fcf:'fcfVal',sbc:'sbcVal',shares:'sharesOutstanding',marketCap:'marketCap',debt:'debtVal',cash:'cashVal'};
  const issues=validation.issues.map(i=>i.code==='ROIC_SIGN_MISMATCH'&&manual.has('roic')?{...i,manualCalculation:true,message:'ROIC manual utilizado pese a su discrepancia con el resultado operativo. Revisar periodo y definición.'}:i.severity==='error'&&(manual.has(i.field)||manual.has(aliases[i.field])||i.field==='history'&&(manual.has('revHistory')||manual.has('oiHistory')))?{...i,severity:'warning',manualCalculation:true,message:`Entrada manual: ${i.message}`} :i);
  return {...validation,issues,hasErrors:issues.some(i=>i.severity==='error'),errorCodes:issues.filter(i=>i.severity==='error').map(i=>i.code)};
}
