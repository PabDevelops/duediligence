'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useUser} from '../../components/AuthProvider';
import {SuggestionFields,suggestionFormCss} from '../../components/company-analysis/FinancialSuggestion';
import {suggestionFormMetadata,documentedSuggestionMetadata,parseSuggestionNumber} from '../../../lib/financialSuggestions';
import {financialOverrideStorageTarget} from '../../../lib/financialOverrides';
import {NEW_COLORS as C} from '../../components/new/theme';

const states={pending:'Pendiente',accepted:'Aceptada',rejected:'Rechazada'};
const amount=v=>v==null?'N/D':Number(v).toLocaleString('es-ES');
const window=p=>[p?.basis,p?.periodStart,p?.periodEnd,p?.currency,p?.scope].filter(Boolean).join(' · ')||'Sin documentar';
async function fetchQueue(status,before){
 const r=await fetch(`/api/admin/financial-suggestions?status=${status}${before?`&before=${before}`:''}`,{cache:'no-store'}),j=await r.json();
 if(!r.ok)throw new Error(j.error||'No se pudo cargar.');return j;
}
function Review({detail,onSaved,onClose}){
 const {item,current,revisions}=detail;
 const [value,setValue]=useState(item.proposed_value==null?'':String(item.proposed_value));
 const [metadata,setMetadata]=useState(suggestionFormMetadata(item.proposed_metadata));
 const [note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async action=>{
  setError('');let body={id:item.id,action,note};
  try{if(action==='accepted'){
   const documented=documentedSuggestionMetadata(metadata),target=financialOverrideStorageTarget(item.target,documented);
   body={...body,value:parseSuggestionNumber(value),metadata:{...documented,note:note||'Corrección revisada a partir de una sugerencia de datos.'},expectedId:revisions.find(r=>r.target===target)?.id||0};
  }}catch(err){setError(err.message);return;}
  setBusy(true);
  try{const r=await fetch('/api/admin/financial-suggestions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await r.json();if(!r.ok)throw new Error(json.error||'No se pudo guardar.');await onSaved();onClose();}
  catch(err){setError(err.message);}finally{setBusy(false);}
 };
 return <section style={{padding:20,border:`1px solid ${C.border}`,borderRadius:16,background:C.surface,overflowWrap:'anywhere'}}>
  <h2 style={{fontSize:18}}>#{item.id} · {item.ticker} · {item.label}</h2>
  <p>{states[item.status]} · Recibida el {new Date(item.created_at).toLocaleString('es-ES')} · Usuario {item.reporter?.slice(0,8)||'eliminado'}</p>
  <p><strong>Motivo:</strong> {item.reason}</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
   <div><strong>Observado al enviar</strong><p>{amount(item.observed_value)}<br/>{window(item.observed_metadata)}</p></div>
   <div><strong>Actual al abrir la revisión</strong><p>{amount(current?.value)}<br/>{window(current?.metadata)}</p></div>
   <div><strong>Propuesto</strong><p>{amount(item.proposed_value)}<br/>{window(item.proposed_metadata)}</p></div>
  </div>
  <p><strong>Fuente propuesta:</strong> {item.proposed_metadata?.sourceUrl||'Sin documentar'}</p>
  {item.status==='pending'?<div className="suggestion-form" style={{display:'grid',gap:12}}>
   <p>Revisa o ajusta la propuesta. Aceptar crea una corrección manual con historial; no acredita verificación automática.</p>
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'grid',gap:12,minWidth:0}}>
    <SuggestionFields value={value} setValue={setValue} metadata={metadata} setMetadata={setMetadata}/>
    <label>Nota de revisión o justificación del ajuste<textarea maxLength={1000} rows={2} value={note} onChange={e=>setNote(e.target.value)}/></label>
    {!detail.canAccept&&<p>La edición financiera está desactivada. Puedes revisar o rechazar, pero no aplicar cambios.</p>}
    {error&&<p role="alert" style={{color:C.red}}>{error}</p>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={!detail.canAccept} style={{background:C.lime||'#C7FF38',fontWeight:700}} onClick={()=>submit('accepted')}>Aceptar y aplicar los datos revisados</button><button onClick={()=>submit('rejected')}>Rechazar</button><button onClick={onClose}>Cerrar</button></div>
   </fieldset>
  </div>:<><p>Revisada el {item.reviewed_at&&new Date(item.reviewed_at).toLocaleString('es-ES')}. {item.review_note}</p>{item.override_revision_id&&<p>Corrección #{item.override_revision_id}: {amount(item.reviewed_value)} · {window(item.reviewed_metadata)}. Se puede restaurar desde la cifra correspondiente en el análisis.</p>}<button onClick={onClose}>Cerrar</button></>}
 </section>;
}
export default function FinancialSuggestionsPage(){
 const auth=useUser();
 const [admin,setAdmin]=useState(null),[status,setStatus]=useState('pending'),[items,setItems]=useState([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[detail,setDetail]=useState(null);
 const listRequest=useRef(0),detailRequest=useRef(0);
 useEffect(()=>{if(auth.isLoaded)fetch('/api/admin/check').then(r=>r.json()).then(j=>setAdmin(!!j.isAdmin)).catch(()=>setAdmin(false));},[auth.isLoaded]);
 const load=async(before)=>{
  const request=++listRequest.current;setLoading(true);setError('');
  try{const j=await fetchQueue(status,before);if(request===listRequest.current){setItems(p=>before?[...p,...j.items]:j.items);setMore(j.hasMore);}}
  catch(err){if(request===listRequest.current)setError(err.message||'No se pudo cargar.');}finally{if(request===listRequest.current)setLoading(false);}
 };
 // Selection changes discard the previous revision snapshot; accepting uses only
 // the revisions returned when that review was opened, never a silent refresh.
 useEffect(()=>{
  if(!admin)return;const request=++listRequest.current;
  fetchQueue(status).then(j=>{if(request===listRequest.current){setItems(j.items);setMore(j.hasMore);setError('');}}).catch(err=>{if(request===listRequest.current)setError(err.message);}).finally(()=>{if(request===listRequest.current)setLoading(false);});
  return ()=>{
   // These refs are request counters, not DOM nodes. Invalidate in-flight work.
   // eslint-disable-next-line react-hooks/exhaustive-deps
   listRequest.current++;detailRequest.current++;
  };
 },[admin,status]);
 const open=async id=>{const request=++detailRequest.current;setError('');try{const r=await fetch(`/api/admin/financial-suggestions?id=${id}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);if(request===detailRequest.current)setDetail(j);}catch(err){if(request===detailRequest.current)setError(err.message||'No se pudo abrir.');}};
 return <main style={{maxWidth:920,margin:'0 auto',padding:'32px 20px 96px',color:C.ink,background:C.bg,minHeight:'100vh'}}>
  <style>{suggestionFormCss}</style><Link href="/admin">← Admin</Link><h1>Correcciones sugeridas</h1>
  {!auth.isLoaded||admin===null?<p>Cargando…</p>:!auth.isSignedIn||!admin?<p>No autorizado.</p>:<>
   <p>Las propuestas de usuarios no modifican datos hasta que las aceptas. Revisa la fuente, periodo y moneda antes de aplicar.</p>
   <label>Estado <select value={status} onChange={e=>{setDetail(null);setLoading(true);setStatus(e.target.value);}}>{Object.entries({...states,all:'Todas'}).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label> <button disabled={loading} onClick={()=>{detailRequest.current++;setDetail(null);load();}}>Actualizar bandeja</button>
   {error&&<p role="alert" style={{color:C.red}}>{error}</p>}
   {detail&&<div style={{margin:'20px 0'}}><Review key={`${detail.item.id}:${detail.item.status}`} detail={detail} onSaved={()=>load()} onClose={()=>setDetail(null)}/></div>}
   {loading?<p>Cargando sugerencias…</p>:items.length===0?<p>No hay sugerencias con este estado.</p>:null}
   <div style={{display:'grid',gap:10,marginTop:18}}>{items.map(item=><button key={item.id} onClick={()=>open(item.id)} style={{textAlign:'left',padding:16,border:`1px solid ${C.border}`,borderRadius:12,background:C.surface,color:C.ink,cursor:'pointer',overflowWrap:'anywhere'}}><strong>{item.ticker} · {item.label}</strong><div>{states[item.status]} · {amount(item.observed_value)} → {amount(item.proposed_value)}</div><div style={{fontSize:12,marginTop:6}}>{item.reason}</div></button>)}</div>
   {more&&<button disabled={loading} onClick={()=>load(items.at(-1)?.id)} style={{marginTop:16}}>Cargar más</button>}
  </>}
 </main>;
}
