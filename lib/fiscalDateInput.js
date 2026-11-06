// Keep the user's text untouched while typing. Convert only on submission;
// native date controls otherwise use the browser's month/day order.
export function parseFiscalDateInput(text='') {
  const raw=String(text).trim();
  if(!raw)return '';
  const local=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const compact=/^(\d{2})(\d{2})(\d{4})$/.exec(raw);
  const parts=local||compact;
  const iso=parts?`${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`:raw;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||Number.isNaN(Date.parse(iso)))return null;
  return new Date(iso).toISOString().slice(0,10)===iso?iso:null;
}
export function formatFiscalDateInput(iso) {
  const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');
  return parts?`${parts[3]}/${parts[2]}/${parts[1]}`:iso||'';
}
