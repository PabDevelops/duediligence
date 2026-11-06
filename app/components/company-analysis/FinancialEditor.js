'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {useUser} from '../AuthProvider';
import {applyFinancialOverrides,cleanOverrideMetadata,financialOverrideStorageTarget,isRatioField,overrideTarget,validateFinancialOverride} from '../../../lib/financialOverrides';
import {formatFiscalDateInput,parseFiscalDateInput} from '../../../lib/fiscalDateInput';
const EditorContext=createContext(null);
export function FinancialEditorProvider({children,...props}){
  const auth=useUser();
  return <FinancialEditorSession key={`${props.ticker}:${auth.user?.id||'guest'}`} {...props} auth={auth}>{children}</FinancialEditorSession>;
}
export function FinancialEditorSession({ticker,data,onSaved,auth,children}){
  const [admin,setAdmin]=useState(false),[rows,setRows]=useState([]),[selected,setSelected]=useState(null),[problem,setProblem]=useState('');
  useEffect(()=>{let live=true;
    if(auth.isLoaded&&auth.isSignedIn&&!data.isEtf)fetch('/api/admin/check').then(r=>r.json()).then(async result=>{
      if(!result.isAdmin||!live)return;
      const response=await fetch(`/api/admin/financial-overrides?ticker=${encodeURIComponent(ticker)}`,{cache:'no-store'}),json=await response.json();
      if(!live)return;
      if(!response.ok){setProblem(json.error||'No se pudo activar la edición.');return;}
      setRows(json.overrides||[]);setAdmin(true);
    }).catch(()=>{if(live)setProblem('No se pudo comprobar el permiso de edición.');});
    return ()=>{live=false;};
  },[auth.isLoaded,auth.isSignedIn,ticker,data.isEtf]);
  const saved=async()=>{
    const r=await fetch(`/api/admin/financial-overrides?ticker=${encodeURIComponent(ticker)}`,{cache:'no-store'});
    if(r.ok)setRows((await r.json()).overrides||[]);
    await onSaved();
  };
  return <EditorContext.Provider value={{admin,data,open:setSelected}}>
    {admin&&<p style={{fontSize:12,color:'#726C5E'}}>Administración: pulsa una cifra o N/D para corregirla. Los cambios se publican para todos y se conservan hasta que los restaures.</p>}
    {problem&&<p role="status" style={{fontSize:12}}>{problem}</p>}
    {children}
    {selected&&<CorrectionDialog key={selected.target} ticker={ticker} selected={selected} data={data}
      rows={rows} current={rows.find(r=>r.target===selected.target)} onSaved={saved} onClose={()=>setSelected(null)}/>}
  </EditorContext.Provider>;
}
export function EditableFinancialValue({target,label,children,point}){
  const editor=useContext(EditorContext),manual=editor?.data?.manualCorrections?.find(r=>r.target===target);
  const state=manual&&editor?.data?.financialIntegrity?.fields?.[manual.field];
  const value=<>{children}{manual&&<small title={state?.reason} style={{display:'block',fontSize:10,color:'#726C5E'}}>Manual · {manual.period?.basis||'sin verificar'}{manual.period?.periodEnd?` · ${formatFiscalDateInput(manual.period.periodEnd)}`:''}{state?.status==='blocked'?' · incompatible':' · provisional'}{state?.modelExcluded?' · solo este periodo':''}</small>}</>;
  const primary=!editor?.admin||!overrideTarget(target)?value:<button type="button" title={`Corregir ${label}`} aria-label={`Corregir ${label}`}
    onClick={()=>editor.open({target,label,point})} style={{font:'inherit',color:'inherit',background:'none',border:0,padding:'4px 0',cursor:'pointer',textAlign:'right',textDecoration:'underline dotted',textUnderlineOffset:4}}>{value}</button>;
  const independent=target==='roa'?(editor?.data?.reportedIndicators||[]).filter(r=>r.field==='roa'):[];
  return <>{primary}{independent.map(r=><div key={r.target} style={{fontSize:12,marginTop:8,fontWeight:400,maxWidth:300}}>
    <EditableFinancialValue target={r.target} label={`ROA ${r.period.basis} ${formatFiscalDateInput(r.period.periodEnd)}`}>
      ROA {r.period.basis}: {r.value==null?'N/D':`${r.value.toLocaleString('es-ES')} %`}
    </EditableFinancialValue>
    <small style={{display:'block'}}>Manual · {formatFiscalDateInput(r.period.periodStart)}–{formatFiscalDateInput(r.period.periodEnd)} · no anualizado</small>
    <small style={{display:'block'}}>Activos medios: {formatFiscalDateInput(r.period.roaBasis.assetsStartDate)}–{formatFiscalDateInput(r.period.roaBasis.assetsEndDate)} · {r.period.currency} · {r.period.scope==='consolidated'?'consolidado':r.period.scope==='standalone'?'sociedad individual':'perímetro sin verificar'}</small>
    <small style={{display:'block'}}>Pendiente de contraste · excluido de notas y valoraciones</small>
    {r.period.sourceUrl&&<a href={r.period.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11}}>Fuente</a>}
  </div>)}</>;
}
function CorrectionDialog({ticker,selected,data,current,rows,onSaved,onClose}){
  const ref=useRef(null),t=overrideTarget(selected.target),ratio=isRatioField(t.field);
  const original=selected.point||data.financialPeriods?.[t.field]||{};
  const initial=current?.active?current.metadata:original;
  const raw=current?.active?current.value:selected.point?(t.history==='epsHistory'?selected.point.eps:selected.point.val):data[t.field];
  const [value,setValue]=useState(raw==null?'':String(raw)),[factor,setFactor]=useState('1');
  const [metadata,setMetadata]=useState({basis:initial.basis||'unknown',currency:initial.currency||data.currency||'USD',scope:initial.scope||'provider-unspecified',periodStart:initial.periodStart||'',periodEnd:initial.periodEnd||'',sourceUrl:initial.sourceUrl||'',note:current?.active?initial.note||'':'',roaBasis:initial.roaBasis||{annualized:false,denominator:''}});
  const [dateInputs,setDateInputs]=useState({periodStart:formatFiscalDateInput(initial.periodStart),periodEnd:formatFiscalDateInput(initial.periodEnd),assetsStartDate:formatFiscalDateInput(initial.roaBasis?.assetsStartDate),assetsEndDate:formatFiscalDateInput(initial.roaBasis?.assetsEndDate)});
  const partialRoa=t.field==='roa'&&['H1','Q'].includes(metadata.basis);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{ref.current?.showModal();},[]);
  const change=(key,val)=>setMetadata(prev=>({...prev,[key]:val}));
  const save=async reset=>{
    setBusy(true);setError('');
    const normalized=value.trim().replace(',','.');
    if(!reset&&normalized&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)){setError('Usa un número sin separadores de miles, por ejemplo 1250000 o 12,5.');setBusy(false);return;}
    if(!reset&&normalized&&!Number.isFinite(Number(normalized)*Number(factor))){setError('El importe es demasiado grande.');setBusy(false);return;}
    const periodStart=metadata.basis==='instant'?'':parseFiscalDateInput(dateInputs.periodStart);
    const periodEnd=parseFiscalDateInput(dateInputs.periodEnd);
    if(!reset&&(periodStart===null||periodEnd===null)){setError('Introduce las fechas como DD/MM/AAAA, por ejemplo 30/06/2026.');setBusy(false);return;}
    const finalMetadata={...metadata,periodStart,periodEnd,...(partialRoa?{roaBasis:{...metadata.roaBasis,assetsStartDate:parseFiscalDateInput(dateInputs.assetsStartDate),assetsEndDate:parseFiscalDateInput(dateInputs.assetsEndDate)}}:{})};
    const storageTarget=reset?selected.target:financialOverrideStorageTarget(selected.target,finalMetadata);
    const expectedId=rows.find(r=>r.target===storageTarget)?.id||0;
    if(!reset&&normalized){
      const candidate={ticker,target:storageTarget,expectedId,value:Number(normalized)*Number(factor),active:true,metadata:cleanOverrideMetadata(finalMetadata,storageTarget)};
      const invalid=validateFinancialOverride(candidate);
      if(invalid){setError(invalid);setBusy(false);return;}
      const preview=applyFinancialOverrides(data,[candidate]);
      const field=preview.financialIntegrity?.fields?.[t.field];
      if(!t.history&&!overrideTarget(storageTarget)?.indicatorPeriod&&field?.status==='blocked'){setError(`No se puede utilizar esta corrección: ${field.reason} Revisa el periodo, la moneda y las partidas relacionadas.`);setBusy(false);return;}
    }
    try{
      const response=await fetch('/api/admin/financial-overrides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker,target:storageTarget,expectedId,reset,value:normalized?Number(normalized)*Number(factor):null,metadata:finalMetadata})});
      const json=await response.json();if(!response.ok)throw new Error(json.error||'No se pudo guardar.');
      await onSaved();onClose();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="correction-title" style={{width:'min(520px,calc(100% - 32px))',maxHeight:'90vh',overflowY:'auto',border:'1px solid #ECE1C9',borderRadius:18,padding:24,color:'#1C1B18',background:'#FAF7F0'}}>
    <style>{`dialog::backdrop{background:rgba(28,27,24,.4)}.correction-form label{display:flex;flex-direction:column;gap:5px;font-size:12px}.correction-form input,.correction-form select,.correction-form textarea{padding:9px;border:1px solid #D8CEBA;border-radius:8px;background:white;color:#1C1B18;width:100%;box-sizing:border-box;font:inherit}.correction-form button{padding:10px;border:1px solid #D8CEBA;border-radius:8px;cursor:pointer}.correction-form button:disabled{opacity:.6;cursor:wait}`}</style>
    <h2 id="correction-title" style={{fontSize:18,marginTop:0}}>Corregir {selected.label}</h2>
    <p style={{fontSize:12}}>Se publicará para todos. La corrección no caduca ni se borra al actualizar el proveedor. Las comprobaciones financieras siguen aplicándose.</p>
    {t.year&&<p style={{fontSize:12}}>Ejercicio histórico: <strong>{t.year}</strong>.</p>}
    <p style={{fontSize:12}}>{['revGrowth','epsCagr','grossMargin','opMargin','netMargin','roe','roa','roic','dividendYield','insiderOwnershipPct'].includes(t.field)?'Porcentaje en puntos: 10 significa 10%.':ratio?'Ratio o medida sin moneda.':t.field.toLowerCase().includes('shares')?'Número de acciones.':'Importe contable en la moneda indicada.'} Introduce el dato original, sin redondearlo al formato de la pantalla.</p>
    {current?.active&&<p style={{fontSize:12}}>{t.indicatorPeriod?'Ya existe un dato de este periodo. Retirarlo conserva su historial y no modifica el ROA principal.':'Ya existe una corrección manual. «Restaurar proveedor» volverá al dato automático actual.'}</p>}
    <form className="correction-form" onSubmit={e=>{e.preventDefault();save(false);}} style={{display:'grid',gap:12}}>
      <label>Valor (vacío guarda N/D)<input autoFocus inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} disabled={busy}/></label>
      {!ratio&&<label>Unidades introducidas<select value={factor} onChange={e=>setFactor(e.target.value)} disabled={busy}><option value="1">Unidades completas</option><option value="1000">Miles</option><option value="1000000">Millones</option></select></label>}
      <label>Moneda<select value={metadata.currency} onChange={e=>change('currency',e.target.value)} disabled={busy}>{[...new Set([metadata.currency,'EUR','USD','GBP','GBp','CHF','CAD','AUD','JPY','CNY'])].map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Periodo<select value={metadata.basis} onChange={e=>change('basis',e.target.value)} disabled={busy}>{[['unknown','Sin verificar'],['FY','Ejercicio completo (FY)'],['TTM','Últimos 12 meses (TTM)'],['H1','Semestre (H1)'],['Q','Trimestre (Q)'],['instant','Balance a una fecha']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      {partialRoa&&<fieldset style={{border:'1px solid #D8CEBA',borderRadius:8,padding:12,display:'grid',gap:10}}>
        <legend>ROA independiente del periodo</legend>
        <p style={{fontSize:12,margin:0}}>No anualizado. Se conservará aparte del ROA principal y no entrará en notas ni valoraciones. Pendiente de contraste de sus componentes.</p>
        <label>Base del denominador<select value={metadata.roaBasis.denominator} disabled={busy} onChange={e=>change('roaBasis',{...metadata.roaBasis,denominator:e.target.value})}><option value="">Selecciona la base real</option><option value="average-assets">Media de activos de apertura y cierre</option></select></label>
        {['assetsStartDate','assetsEndDate'].map((key,i)=><label key={key}>{i===0?'Activos al cierre anterior al inicio':'Activos al cierre del periodo'}<input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={dateInputs[key]} onChange={e=>setDateInputs(p=>({...p,[key]:e.target.value}))} disabled={busy}/></label>)}
      </fieldset>}
      {['opMargin','netMargin','grossMargin'].includes(t.field)&&['Q','H1'].includes(metadata.basis)&&<p role="status" style={{fontSize:12,margin:0}}>Se mostrará como margen manual provisional de este periodo. No sustituirá un margen anual o TTM en las notas y valoraciones.</p>}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><label style={{flex:'1 1 150px'}}>Desde<input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={dateInputs.periodStart} onChange={e=>setDateInputs(p=>({...p,periodStart:e.target.value}))} disabled={busy||metadata.basis==='instant'}/></label><label style={{flex:'1 1 150px'}}>Hasta / fecha<input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={dateInputs.periodEnd} onChange={e=>setDateInputs(p=>({...p,periodEnd:e.target.value}))} disabled={busy}/></label></div>
      <small style={{fontSize:11,color:'#726C5E'}}>Fechas en día/mes/año. También puedes escribir 30062026, sin barras.</small>
      <label>Perímetro<select value={metadata.scope} onChange={e=>change('scope',e.target.value)} disabled={busy}><option value="provider-unspecified">Sin verificar</option><option value="consolidated">Grupo consolidado</option><option value="standalone">Sociedad individual</option></select></label>
      <label>Fuente (enlace opcional)<input type="url" value={metadata.sourceUrl} onChange={e=>change('sourceUrl',e.target.value)} disabled={busy}/></label>
      <label>Justificación<textarea required minLength={3} maxLength={1000} rows={2} value={metadata.note} onChange={e=>change('note',e.target.value)} disabled={busy}/></label>
      {error&&<p role="alert" style={{color:'#9A3A2F',fontSize:12}}>{error}</p>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={busy} type="submit" style={{background:'#C7FF38',fontWeight:700}}>{busy?'Guardando…':'Guardar para todos'}</button><button disabled={busy} type="button" onClick={onClose}>Cancelar</button>{current?.active&&<button disabled={busy} type="button" onClick={()=>save(true)}>{t.indicatorPeriod?'Retirar dato de este periodo':'Restaurar proveedor'}</button>}</div>
    </form>
  </dialog>;
}
