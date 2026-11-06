'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {useUser} from '../AuthProvider';
import {financialOverrideStorageTarget,isRatioField,overrideTarget} from '../../../lib/financialOverrides';
import {HISTORY_FIELDS} from '../../../lib/financialIntegrity';
import {formatFiscalDateInput,parseFiscalDateInput} from '../../../lib/fiscalDateInput';
const EditorContext=createContext(null);
export function AddHistoricalFcf(){
  return <AddHistoricalValue history="fcfHistory" label="FCF histórico"/>;
}
export function AddHistoricalSbc(){
  return <AddHistoricalValue history="sbcHistory" label="SBC histórico"/>;
}
function AddHistoricalValue({history,label}){
  const editor=useContext(EditorContext);
  if(!editor?.admin)return null;
  return <button type="button" onClick={()=>editor.open({target:`add:${history}`,newHistory:history,label,point:{basis:'FY'}})} style={{padding:'8px 12px',margin:'10px 0',border:'1px solid #D8CEBA',borderRadius:8,background:'#FAF7F0',color:'#1C1B18',cursor:'pointer'}}>Añadir {label}</button>;
}
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
export function EditableFinancialValue({target,label,children,point,showStoredValue=false,nested=false}){
  const editor=useContext(EditorContext),manual=editor?.data?.manualCorrections?.find(r=>r.target===target||r.appliedToCurrent&&r.field===target);
  const state=manual&&!target.startsWith('history:')&&editor?.data?.financialIntegrity?.fields?.[manual.field];
  const excluded=manual?.modelExcluded||state?.status==='blocked'||state?.modelExcluded;
  const stored=manual?.value==null?'N/D':`${manual.value.toLocaleString('es-ES',{maximumSignificantDigits:17})}${['revGrowth','epsCagr','grossMargin','opMargin','netMargin','roe','roa','roic','dividendYield','insiderOwnershipPct'].includes(manual.field)?' %':isRatioField(manual.field)?'':manual.period?.unit==='shares'?' acciones':` ${manual.period?.currency||'moneda sin documentar'}`}`;
  const value=<>{manual&&!nested&&(showStoredValue||isRatioField(manual.field))?stored:children}{manual&&!nested&&<small style={{display:'block',fontSize:11,color:'#726C5E',whiteSpace:'normal',maxWidth:280}}>
    Manual guardado: {stored} · {manual.period?.basis||'sin verificar'}{manual.period?.periodEnd?` · ${formatFiscalDateInput(manual.period.periodEnd)}`:''}
    <span style={{display:'block'}}>{manual.value==null?'Sin valor numérico: se conserva N/D.':manual.manualCalculation?`Utilizado como entrada manual · no verificado automáticamente. ${manual.reason||''}`:excluded?`No utilizado en cálculos: ${manual.reason||state?.reason||'Periodo no compatible con el modelo.'}`:'Disponible para cálculos compatibles · provisional'}</span>
  </small>}</>;
  const primary=!editor?.admin||!overrideTarget(target)?value:<button type="button" title={`Corregir ${label}`} aria-label={`Corregir ${label}`}
    onClick={()=>editor.open({target:manual?.appliedToCurrent?manual.target:target,label,point})} style={{font:'inherit',color:'inherit',background:'none',border:0,padding:'4px 0',cursor:'pointer',textAlign:'right',textDecoration:'underline dotted',textUnderlineOffset:4}}>{value}</button>;
  const independent=!nested&&['roa','roe'].includes(target)?(editor?.data?.reportedIndicators||[]).filter(r=>r.field===target):[];
  return <>{primary}{independent.map(r=><div key={r.target} style={{fontSize:12,marginTop:8,fontWeight:400,maxWidth:300}}>
    <EditableFinancialValue nested target={r.target} label={`${r.field.toUpperCase()} ${r.period.basis} ${formatFiscalDateInput(r.period.periodEnd)}`}>
      {r.field.toUpperCase()} {r.period.basis}: {r.value==null?'N/D':`${r.value.toLocaleString('es-ES')} %`}
    </EditableFinancialValue>
    <small style={{display:'block'}}>Manual · {formatFiscalDateInput(r.period.periodStart)||'inicio sin documentar'}–{formatFiscalDateInput(r.period.periodEnd)||'fin sin documentar'} · {(r.period.returnBasis||r.period.roaBasis)?.annualized===false?'no anualizado':(r.period.returnBasis||r.period.roaBasis)?.annualized===true?'anualizado':'anualización sin documentar'}</small>
    <small style={{display:'block'}}>{r.field==='roe'?'Patrimonio medio':'Activos medios'}: {formatFiscalDateInput((r.period.returnBasis||r.period.roaBasis)?.assetsStartDate)||'fecha sin documentar'}–{formatFiscalDateInput((r.period.returnBasis||r.period.roaBasis)?.assetsEndDate)||'fecha sin documentar'} · {r.period.currency||'moneda sin documentar'} · {r.period.scope==='consolidated'?'consolidado':r.period.scope==='standalone'?'sociedad individual':'perímetro sin verificar'}</small>
    <small style={{display:'block'}}>{editor?.data?.manualCorrections?.some(m=>m.target===r.target&&(m.appliedToCurrent||m.manualCalculation))?'Entrada manual utilizada. Las discrepancias del contraste son advertencias; no se anualiza automáticamente.':`${r.status==='period-comparable'?'Contrastado para este periodo':'Pendiente de contraste'}. Registro independiente del indicador principal. ${r.reason}`}</small>
    {r.periodCalculation&&<details><summary>Ver cálculo del periodo</summary>Beneficio: {r.periodCalculation.netIncome.toLocaleString('es-ES')} {r.periodCalculation.currency}; denominador medio: {r.periodCalculation.meanBalance.toLocaleString('es-ES')}. Resultado contrastado: {r.periodCalculation.calculatedValue} %. Sin anualizar. Perímetro de los componentes: {r.periodCalculation.scope==='consolidated'?'consolidado':'sociedad individual'}.</details>}
    {r.period.sourceUrl&&<a href={r.period.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11}}>Fuente</a>}
  </div>)}</>;
}
function CorrectionDialog({ticker,selected,data,current,rows,onSaved,onClose}){
  const ref=useRef(null),t=selected.newHistory?{history:selected.newHistory,field:HISTORY_FIELDS[selected.newHistory]}:overrideTarget(selected.target),ratio=isRatioField(t.field);
  const original=selected.point||data.financialPeriods?.[t.field]||{};
  const initial=current?.active?current.metadata:original;
  const raw=selected.newHistory?null:current?.active?current.value:selected.point?(t.history==='epsHistory'?selected.point.eps:selected.point.val):data[t.field];
  const [exercise,setExercise]=useState(t.year||'');
  const [cashInputs,setCashInputs]=useState({operatingCF:initial.fcfInputs?.operatingCF??'',capex:initial.fcfInputs?.capex??''});
  const [value,setValue]=useState(raw==null?'':String(raw)),[factor,setFactor]=useState('1');
  const [metadata,setMetadata]=useState({basis:initial.basis||'unknown',currency:initial.currency||'',scope:initial.scope||'provider-unspecified',periodStart:initial.periodStart||'',periodEnd:initial.periodEnd||'',sourceUrl:initial.sourceReference||initial.sourceUrl||'',note:current?.active?initial.note||'':'',returnBasis:initial.returnBasis||initial.roaBasis||{annualized:null,denominator:''}});
  const [dateInputs,setDateInputs]=useState({periodStart:formatFiscalDateInput(initial.periodStart),periodEnd:formatFiscalDateInput(initial.periodEnd),assetsStartDate:formatFiscalDateInput((initial.returnBasis||initial.roaBasis)?.assetsStartDate),assetsEndDate:formatFiscalDateInput((initial.returnBasis||initial.roaBasis)?.assetsEndDate)});
  const partialReturn=['roa','roe'].includes(t.field)&&['H1','Q'].includes(metadata.basis);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{ref.current?.showModal();},[]);
  const change=(key,val)=>setMetadata(prev=>({...prev,[key]:val}));
  const save=async reset=>{
    setBusy(true);setError('');
    const normalized=value.trim().replace(',','.');
    if(!reset&&normalized&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)){setError('Usa un número sin separadores de miles, por ejemplo 1250000 o 12,5.');setBusy(false);return;}
    if(!reset&&normalized&&!Number.isFinite(Number(normalized)*Number(factor))){setError('El importe es demasiado grande.');setBusy(false);return;}
    const documentedDate=text=>parseFiscalDateInput(text)??text.trim();
    const periodStart=documentedDate(dateInputs.periodStart),periodEnd=documentedDate(dateInputs.periodEnd);
    const finalMetadata={...metadata,periodStart,periodEnd,...(partialReturn?{returnBasis:{...metadata.returnBasis,assetsStartDate:documentedDate(dateInputs.assetsStartDate),assetsEndDate:documentedDate(dateInputs.assetsEndDate)}}:{})};
    if(!reset&&t.history==='fcfHistory'){
      const parsed={};
      for(const key of ['operatingCF','capex']){
        const text=String(cashInputs[key]).trim().replace(',','.');
        if(text&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)){setError('OCF y CAPEX deben ser números, o quedar vacíos.');setBusy(false);return;}
        parsed[key]=text?Number(text)*Number(factor):null;
      }
      finalMetadata.fcfInputs=parsed;
    }
    const year=exercise||(/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)?periodEnd.slice(0,4):'');
    if(selected.newHistory&&!/^\d{4}$/.test(year)){setError('Indica el ejercicio o una fecha de cierre completa para identificar el registro histórico.');setBusy(false);return;}
    const storageTarget=selected.newHistory?`history:${selected.newHistory}:${year}`:reset?selected.target:financialOverrideStorageTarget(selected.target,finalMetadata);
    if(selected.newHistory&&rows.some(r=>r.target===storageTarget&&r.active)){setError('Ya existe una corrección para ese ejercicio. Edítala desde su fila en la tabla.');setBusy(false);return;}
    const expectedId=rows.find(r=>r.target===storageTarget)?.id||0;
    try{
      const response=await fetch('/api/admin/financial-overrides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker,target:storageTarget,expectedId,reset,value:normalized?Number(normalized)*Number(factor):null,metadata:finalMetadata})});
      const json=await response.json();if(!response.ok)throw new Error(json.error||'No se pudo guardar.');
      await onSaved();onClose();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="correction-title" style={{width:'min(520px,calc(100% - 32px))',maxHeight:'90vh',overflowY:'auto',border:'1px solid #ECE1C9',borderRadius:18,padding:24,color:'#1C1B18',background:'#FAF7F0'}}>
    <style>{`dialog::backdrop{background:rgba(28,27,24,.4)}.correction-form label{display:flex;flex-direction:column;gap:5px;font-size:12px}.correction-form input,.correction-form select,.correction-form textarea{padding:9px;border:1px solid #D8CEBA;border-radius:8px;background:white;color:#1C1B18;width:100%;box-sizing:border-box;font:inherit}.correction-form button{padding:10px;border:1px solid #D8CEBA;border-radius:8px;cursor:pointer}.correction-form button:disabled{opacity:.6;cursor:wait}`}</style>
    <h2 id="correction-title" style={{fontSize:18,marginTop:0}}>Corregir {selected.label}</h2>
    <p style={{fontSize:12}}>Se guarda para todos. Los datos no comparables quedan fuera de los cálculos; puedes guardarlos igualmente.</p>
    {t.year&&<p style={{fontSize:12}}>Ejercicio histórico: <strong>{t.year}</strong>.</p>}
    <p style={{fontSize:12}}>{['revGrowth','epsCagr','grossMargin','opMargin','netMargin','roe','roa','roic','dividendYield','insiderOwnershipPct'].includes(t.field)?'Porcentaje: 10 significa 10%.':ratio?'Ratio o medida sin moneda.':t.field.toLowerCase().includes('shares')?'Número de acciones.':'Importe en unidades completas, salvo que elijas otras unidades en detalles.'}</p>
    {current?.active&&<p style={{fontSize:12}}>Corrección permanente. Puedes editarla o {t.indicatorPeriod?'retirar este periodo':'restaurar el proveedor'}.</p>}
    <form className="correction-form" onSubmit={e=>{e.preventDefault();save(false);}} style={{display:'grid',gap:12}}>
      <label>Valor (vacío guarda N/D)<input autoFocus inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} disabled={busy}/></label>
      {t.history==='sbcHistory'&&<small>SBC es el importe de remuneración en acciones, no un porcentaje sobre ingresos.</small>}


      <label>Periodo<select value={metadata.basis} onChange={e=>change('basis',e.target.value)} disabled={busy}>{[['unknown','Sin verificar'],['FY','Ejercicio completo (FY)'],['TTM','Últimos 12 meses (TTM)'],['H1','Semestre (H1)'],['Q','Trimestre (Q)'],['instant','Balance a una fecha']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      {selected.newHistory&&<label>Ejercicio (opcional si indicas el cierre)<input inputMode="numeric" maxLength={4} placeholder="AAAA" value={exercise} onChange={e=>setExercise(e.target.value)} disabled={busy}/></label>}

      {['opMargin','netMargin','grossMargin'].includes(t.field)&&['Q','H1'].includes(metadata.basis)&&<p role="status" style={{fontSize:12,margin:0}}>Se mostrará como margen manual provisional de este periodo. No sustituirá un margen anual o TTM en las notas y valoraciones.</p>}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><label style={{flex:'1 1 150px'}}>Desde (opcional)<input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={dateInputs.periodStart} onChange={e=>setDateInputs(p=>({...p,periodStart:e.target.value}))} disabled={busy}/></label><label style={{flex:'1 1 150px'}}>Hasta / fecha (opcional)<input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={dateInputs.periodEnd} onChange={e=>setDateInputs(p=>({...p,periodEnd:e.target.value}))} disabled={busy}/></label></div>
      <small style={{fontSize:11,color:'#726C5E'}}>Fechas en día/mes/año. También puedes escribir 30062026, sin barras.</small>

      <label>Moneda (opcional)<select value={metadata.currency} onChange={e=>change('currency',e.target.value)} disabled={busy}><option value="">Sin documentar</option>{[...new Set([metadata.currency,'EUR','USD','GBP','GBp','CHF','CAD','AUD','JPY','CNY'])].filter(Boolean).map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Fuente o enlace (opcional)<input type="text" maxLength={2048} value={metadata.sourceUrl} onChange={e=>change('sourceUrl',e.target.value)} disabled={busy}/></label>
      <label>Justificación (opcional)<textarea maxLength={1000} rows={2} value={metadata.note} onChange={e=>change('note',e.target.value)} disabled={busy}/></label>
      <details><summary>Detalles opcionales: unidades, perímetro y método</summary><div style={{display:'grid',gap:12,marginTop:12}}>
      {!ratio&&<label>Unidades introducidas<select value={factor} onChange={e=>setFactor(e.target.value)} disabled={busy}><option value="1">Unidades completas</option><option value="1000">Miles</option><option value="1000000">Millones</option></select></label>}
      <label>Perímetro<select value={metadata.scope} onChange={e=>change('scope',e.target.value)} disabled={busy}><option value="provider-unspecified">Sin verificar</option><option value="consolidated">Grupo consolidado</option><option value="standalone">Sociedad individual</option></select></label>
      {t.history==='fcfHistory'&&<fieldset style={{border:'1px solid #D8CEBA',borderRadius:8,padding:12,display:'grid',gap:10}}><legend>Componentes de FCF (opcionales)</legend><p style={{fontSize:12,margin:0}}>OCF y CAPEX del mismo periodo, moneda y perímetro. Usa las mismas unidades seleccionadas para el FCF. Si faltan, se intentará contrastar con el histórico disponible; puedes guardar igualmente.</p>{[['operatingCF','OCF del ejercicio'],['capex','CAPEX del ejercicio']].map(([key,label])=><label key={key}>{label}<input inputMode="decimal" value={cashInputs[key]} onChange={e=>setCashInputs(p=>({...p,[key]:e.target.value}))} disabled={busy}/></label>)}</fieldset>}
      {partialReturn&&<fieldset style={{border:'1px solid #D8CEBA',borderRadius:8,padding:12,display:'grid',gap:10}}>
        <legend>{t.field.toUpperCase()} del periodo</legend>
        <p style={{fontSize:12,margin:0}}>Se contrasta con los componentes del mismo periodo. No sustituye el rendimiento anual/TTM ni se anualiza automáticamente.</p>
        <label>Anualización documentada<select disabled={busy} value={metadata.returnBasis.annualized==null?'unknown':String(metadata.returnBasis.annualized)} onChange={e=>change('returnBasis',{...metadata.returnBasis,annualized:e.target.value==='unknown'?null:e.target.value==='true'})}><option value="unknown">Sin documentar</option><option value="false">No anualizado</option><option value="true">Anualizado en la fuente (pendiente de validar)</option></select></label>
        <label>Base del denominador<select value={metadata.returnBasis.denominator} disabled={busy} onChange={e=>change('returnBasis',{...metadata.returnBasis,denominator:e.target.value})}><option value="">Selecciona la base real</option><option value={t.field==='roe'?'average-equity':'average-assets'}>Media de apertura y cierre</option></select></label>
        {['assetsStartDate','assetsEndDate'].map((key,i)=><label key={key}>{i===0?'Denominador al cierre anterior al inicio':'Denominador al cierre del periodo'}<input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={dateInputs[key]} onChange={e=>setDateInputs(p=>({...p,[key]:e.target.value}))} disabled={busy}/></label>)}
      </fieldset>}
      </div></details>
      {error&&<p role="alert" style={{color:'#9A3A2F',fontSize:12}}>{error}</p>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={busy} type="submit" style={{background:'#C7FF38',fontWeight:700}}>{busy?'Guardando…':'Guardar para todos'}</button><button disabled={busy} type="button" onClick={onClose}>Cancelar</button>{current?.active&&<button disabled={busy} type="button" onClick={()=>save(true)}>{t.indicatorPeriod?'Retirar dato de este periodo':'Restaurar proveedor'}</button>}</div>
    </form>
  </dialog>;
}
