'use client';
import {useRef,useState,useEffect} from 'react';
import {historicalStatementFields,prepareStatementHistory,saveStatementHistory} from '../../../lib/manualStatementHistory';

export default function StatementHistoryEditor({ticker,statement,rows,data,onSaved,onClose}){
  const ref=useRef(null),completed=useRef(new Map()),fields=historicalStatementFields(statement),balance=statement==='Balance';
  const [year,setYear]=useState(''),[values,setValues]=useState({}),[factor,setFactor]=useState('1');
  const [metadata,setMetadata]=useState({historyBasis:'FY',fiscalQuarter:'',periodStart:'',periodEnd:'',currency:data.currency||'',scope:'provider-unspecified',sourceUrl:'',note:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState('');
  useEffect(()=>{ref.current?.showModal();},[]);
  const change=(key,value)=>setMetadata(p=>({...p,[key]:value}));
  const save=async()=>{
    setError('');let writes;
    try{writes=prepareStatementHistory({ticker,statement,year,values,metadata,factor,rows});}catch(e){setError(e.message);return;}
    setBusy(true);setProgress(`Guardando 0 de ${writes.length} partidas…`);
    try{
      const result=await saveStatementHistory(writes,{completed:completed.current,onProgress:(n,total)=>setProgress(`Guardando ${n} de ${total} partidas…`),send:async body=>{
        const response=await fetch('/api/admin/financial-overrides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const json=await response.json();if(!response.ok)throw new Error(json.error||'No se pudo guardar.');return json;
      }});
      if(result.saved.length)await onSaved();
      if(result.ok){onClose();return;}
      setError(`${result.saved.length?`Guardado confirmado: ${result.saved.join(', ')}. `:'No hay partidas confirmadas como guardadas. '}Fallo en ${result.failed}: ${result.error} Puedes reintentar; las partidas confirmadas sin cambios no se duplican. Si hay un conflicto de versión, cierra y recarga antes de revisar la fila afectada.`);
    }catch(e){setError(`No se pudo actualizar la vista: ${e.message}. Las partidas guardadas conservan su historial. Puedes reintentar.`);}
    finally{setBusy(false);setProgress('');}
  };
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="statement-history-title" style={{width:'min(660px,calc(100% - 32px))',maxHeight:'90vh',overflowY:'auto',border:'1px solid #ECE1C9',borderRadius:18,padding:24,color:'#1C1B18',background:'#FAF7F0'}}>
    <style>{`dialog::backdrop{background:rgba(28,27,24,.4)}.statement-history-form label{display:flex;flex-direction:column;gap:5px;font-size:12px}.statement-history-form input,.statement-history-form select,.statement-history-form textarea{padding:9px;border:1px solid #D8CEBA;border-radius:8px;background:white;color:#1C1B18;width:100%;box-sizing:border-box;font:inherit}.statement-history-form button{padding:10px;border:1px solid #D8CEBA;border-radius:8px;cursor:pointer}`}</style>
    <h2 id="statement-history-title" style={{fontSize:18,marginTop:0}}>Añadir {balance?'balance histórico':'ejercicio de resultados'}</h2>
    <p style={{fontSize:12}}>Solo se guardan las partidas que rellenes. Las vacías conservan sus valores; cero se guarda como cero. Las cifras se publican para todos y quedan en el historial. Puedes restaurar el proveedor desde cada fila.</p>
    <form className="statement-history-form" onSubmit={e=>{e.preventDefault();save();}} style={{display:'grid',gap:12}}>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'grid',gap:12,minWidth:0}}>
        <label>{metadata.historyBasis==='Q'?'Ejercicio fiscal del trimestre':'Ejercicio (opcional si indicas el cierre)'}<input inputMode="numeric" maxLength={4} placeholder="AAAA" value={year} onChange={e=>setYear(e.target.value)}/></label>
        <label>Tipo de histórico<select value={metadata.historyBasis} onChange={e=>change('historyBasis',e.target.value)}><option value="FY">{balance?'Cierre anual':'Ejercicio completo (FY)'}</option><option value="Q">{balance?'Cierre trimestral':'Trimestre (Q)'}</option></select></label>
        {metadata.historyBasis==='Q'&&<label>Trimestre fiscal<select value={metadata.fiscalQuarter} onChange={e=>change('fiscalQuarter',e.target.value)}><option value="">Selecciona Q1–Q4</option>{['Q1','Q2','Q3','Q4'].map(q=><option key={q}>{q}</option>)}</select></label>}
        <p style={{fontSize:12,margin:0}}>{balance?'Balance a una fecha: no requiere fecha Desde.':metadata.historyBasis==='Q'?'Trimestre independiente. No se anualiza ni sustituye las cifras FY/TTM. Indica las fechas reales de ese trimestre, no las acumuladas de seis o nueve meses.':'Ejercicio completo (FY). No se convertirán semestres ni trimestres en años completos.'}</p>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          {!balance&&<label style={{flex:'1 1 160px'}}>Desde (opcional)<input inputMode="numeric" placeholder="DD/MM/AAAA" value={metadata.periodStart} onChange={e=>change('periodStart',e.target.value)}/></label>}
          <label style={{flex:'1 1 160px'}}>{balance?'Fecha de cierre (opcional)':'Hasta (opcional)'}<input inputMode="numeric" placeholder="DD/MM/AAAA" value={metadata.periodEnd} onChange={e=>change('periodEnd',e.target.value)}/></label>
        </div>
        <label>Moneda (opcional)<select value={metadata.currency} onChange={e=>change('currency',e.target.value)}><option value="">Sin documentar</option>{[...new Set([metadata.currency,'EUR','USD','GBP','GBp','CHF','CAD','AUD','JPY','CNY'])].filter(Boolean).map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Importes monetarios expresados en<select value={factor} onChange={e=>setFactor(e.target.value)}><option value="1">Unidades completas</option><option value="1000">Miles</option><option value="1000000">Millones</option></select></label>
        <label>Perímetro (opcional)<select value={metadata.scope} onChange={e=>change('scope',e.target.value)}><option value="provider-unspecified">Sin verificar</option><option value="consolidated">Grupo consolidado</option><option value="standalone">Sociedad individual</option></select></label>
        <small>Para contrastar ratios del mismo periodo, documenta fechas, moneda y perímetro. Guardar no implica verificar ni mezclar periodos.</small>
        <label>Fuente o enlace (opcional)<input maxLength={2048} value={metadata.sourceUrl} onChange={e=>change('sourceUrl',e.target.value)}/></label>
        <label>Justificación (opcional)<textarea rows={2} maxLength={1000} value={metadata.note} onChange={e=>change('note',e.target.value)}/></label>
        <h3 style={{fontSize:14,marginBottom:0}}>Partidas de {statement.toLowerCase()}</h3>
        {fields.map(f=><label key={f.key}>{f.label}{f.shares?' (número de acciones, siempre en unidades)':''}<input inputMode="decimal" placeholder="Sin modificar" value={values[f.key]||''} onChange={e=>setValues(p=>({...p,[f.key]:e.target.value}))}/></label>)}
        {!balance&&<small>El BPA histórico se calcula con beneficio neto y acciones medias del mismo periodo. No se introduce como una segunda cifra independiente.</small>}
      </fieldset>
      {progress&&<p role="status" style={{fontSize:12}}>{progress}</p>}
      {error&&<p role="alert" style={{color:'#9A3A2F',fontSize:12}}>{error}</p>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={busy} type="submit" style={{background:'#C7FF38',fontWeight:700}}>{busy?'Guardando…':'Guardar partidas para todos'}</button><button disabled={busy} type="button" onClick={onClose}>Cancelar</button></div>
    </form>
  </dialog>;
}
