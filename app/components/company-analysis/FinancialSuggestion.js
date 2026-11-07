'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {financialSuggestionSnapshot,suggestionFormMetadata,documentedSuggestionMetadata,parseSuggestionNumber} from '../../../lib/financialSuggestions';
import {overrideTarget,isRatioField} from '../../../lib/financialOverrides';

export function SuggestionFields({value,setValue,metadata,setMetadata}){
 const change=(k,v)=>setMetadata(p=>({...p,[k]:v}));
 return <>
  <label>Valor propuesto (unidades completas; vacío propone N/D)<input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label>
  <label>Fuente, documento o enlace<input maxLength={2048} value={metadata.sourceUrl||''} onChange={e=>change('sourceUrl',e.target.value)} placeholder="Informe y página, o enlace público"/></label>
  <details><summary>Periodo y moneda de la propuesta</summary><div style={{display:'grid',gap:10,marginTop:10}}>
   <label>Periodo<select value={metadata.basis||'unknown'} onChange={e=>change('basis',e.target.value)}>{[['unknown','Sin documentar'],['FY','Ejercicio completo (FY)'],['TTM','Últimos doce meses (TTM)'],['H1','Semestre (H1)'],['Q','Trimestre (Q)'],['instant','Saldo a una fecha']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
   {metadata.basis==='Q'&&<label>Trimestre fiscal<select value={metadata.fiscalQuarter||''} onChange={e=>change('fiscalQuarter',e.target.value)}><option value="">Sin documentar</option>{['Q1','Q2','Q3','Q4'].map(q=><option key={q}>{q}</option>)}</select></label>}
   <label>Desde (DD/MM/AAAA)<input inputMode="numeric" value={metadata.periodStart||''} onChange={e=>change('periodStart',e.target.value)} placeholder="DD/MM/AAAA"/></label>
   <label>Hasta / cierre (DD/MM/AAAA)<input inputMode="numeric" value={metadata.periodEnd||''} onChange={e=>change('periodEnd',e.target.value)} placeholder="DD/MM/AAAA"/></label>
   <label>Moneda<select value={metadata.currency||''} onChange={e=>change('currency',e.target.value)}><option value="">Sin documentar</option>{[...new Set([metadata.currency,'EUR','USD','GBP','GBp','CHF','CAD','AUD','JPY','CNY'])].filter(Boolean).map(c=><option key={c}>{c}</option>)}</select></label>
   <label>Perímetro<select value={metadata.scope||'provider-unspecified'} onChange={e=>change('scope',e.target.value)}><option value="provider-unspecified">Sin verificar</option><option value="consolidated">Grupo consolidado</option><option value="standalone">Sociedad individual</option></select></label>
  </div></details>
 </>;
}
export const suggestionFormCss=`.suggestion-form label{display:flex;flex-direction:column;gap:5px;font-size:12px}.suggestion-form input,.suggestion-form select,.suggestion-form textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #D8CEBA;border-radius:8px;background:white;color:#1C1B18;font:inherit}.suggestion-form button{padding:10px;border:1px solid #D8CEBA;border-radius:8px;cursor:pointer}.suggestion-form button:disabled{opacity:.6;cursor:wait}`;

export default function FinancialSuggestion({ticker,data,selected,signedIn,onClose}){
 const ref=useRef(null),snapshot=financialSuggestionSnapshot(data,selected.target,selected.point);
 const field=overrideTarget(selected.target)?.field||'',unit=field.toLowerCase().includes('shares')?'acciones':isRatioField(field)?'':snapshot.metadata.currency||'';
 const [value,setValue]=useState(snapshot.value==null?'':String(snapshot.value));
 const [metadata,setMetadata]=useState(suggestionFormMetadata(snapshot.metadata));
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 useEffect(()=>{ref.current?.showModal();},[]);
 const send=async e=>{
  e.preventDefault();setError('');let proposedValue;
  try{proposedValue=parseSuggestionNumber(value);}catch(err){setError(err.message);return;}
  setBusy(true);
  try{
   const response=await fetch('/api/financial-suggestions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker,target:selected.target,label:selected.label,observedValue:snapshot.value,observedMetadata:snapshot.metadata,proposedValue,proposedMetadata:documentedSuggestionMetadata(metadata),reason})});
   const json=await response.json();if(!response.ok)throw new Error(json.error||'No se pudo enviar.');setSent(true);
  }catch(err){setError(err.message);}finally{setBusy(false);}
 };
 return <dialog ref={ref} aria-labelledby="suggestion-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} style={{position:'fixed',inset:0,margin:'auto',boxSizing:'border-box',width:'min(520px,calc(100% - 32px))',maxHeight:'90vh',overflowY:'auto',border:'1px solid #ECE1C9',borderRadius:18,padding:24,color:'#1C1B18',background:'#FAF7F0'}}>
  <style>{`dialog::backdrop{background:rgba(28,27,24,.4)}${suggestionFormCss}`}</style>
  <h2 id="suggestion-title" style={{fontSize:18,marginTop:0}}>Sugerir corrección · {ticker}</h2>
  <p style={{fontSize:13,fontWeight:700}}>{selected.label}</p>
  {!signedIn?<><p>Inicia sesión para enviar una sugerencia al administrador.</p><Link href="/sign-in">Iniciar sesión</Link><button type="button" onClick={onClose} style={{marginLeft:12}}>Cerrar</button></>:sent?<><p role="status">Sugerencia enviada. El administrador la revisará; los datos no se han modificado ni marcado como verificados.</p><button type="button" onClick={onClose}>Cerrar</button></>:<form className="suggestion-form" onSubmit={send} style={{display:'grid',gap:12}}>
   <p style={{fontSize:12,margin:0}}>Valor observado: {snapshot.value==null?'N/D':snapshot.value.toLocaleString('es-ES')} {unit}. Adjuntamos la empresa, partida y documentación actual. En porcentajes, 10 significa 10%.</p>
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'grid',gap:12,minWidth:0}}>
    <SuggestionFields value={value} setValue={setValue} metadata={metadata} setMetadata={setMetadata}/>
    <label>Qué está mal y por qué propones este cambio<textarea required minLength={8} maxLength={1000} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <p style={{fontSize:11,margin:0}}>Máximo 10 envíos en 24 horas. La propuesta y su fuente solo se publicarán si el administrador aplica la corrección.</p>
    {error&&<p role="alert" style={{color:'#9A3A2F'}}>{error}</p>}
    <div style={{display:'flex',gap:8}}><button type="submit" style={{background:'#C7FF38',fontWeight:700}}>{busy?'Enviando…':'Enviar sugerencia'}</button><button type="button" onClick={onClose}>Cancelar</button></div>
   </fieldset>
  </form>}
 </dialog>;
}
