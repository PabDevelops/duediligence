import { financialText } from '../../../lib/currencyPresentation';
import { NEW_COLORS as C } from '../new/theme';
import { STATEMENTS, periodLabel, statementRows, growthPoints } from '../../../lib/analysisPresentation';
import {AddHistoricalFcf,EditableFinancialValue} from './FinancialEditor';
function Table({
  records,
  label
}) {
  return <div className="analysis-table-scroll" tabIndex={0} role="region" aria-label={label}><table className="analysis-table"><caption>{label} · importes en unidades, sin multiplicador implícito</caption><thead><tr>{['Partida', 'Importe / moneda', 'Periodo fiscal', 'Fuente / perímetro', 'Estado'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{records.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td><EditableFinancialValue target={row.editTarget} label={row.editLabel||row.label} point={row.point} showStoredValue={row.showStoredValue}>{row.value}</EditableFinancialValue></td><td>{row.period}</td><td>{row.source}<br />{row.scope}</td><td>{row.status}{row.reason && <><br />{row.reason}</>}</td></tr>)}</tbody></table></div>;
}
export default function FinancialStatements({
  data
}) {
  return <><p style={{
      color: C.text2,
      fontSize: 13
    }}>Se muestran todas las partidas disponibles en BullTrace. N/D significa que la fuente no aporta un dato utilizable. FY, H1, Q y TTM se conservan por separado; las filas no se emparejan por posición ni se suman. En móvil puedes deslizar las tablas horizontalmente.</p>{STATEMENTS.map(([title, fields]) => <article className="analysis-card" key={title}><h3>{title}</h3><Table label={`${title}: cifras actuales`} records={statementRows(data, fields, false)} /><details><summary>Ver histórico completo de {title.toLowerCase()}</summary>{title==='Flujos de caja'&&<AddHistoricalFcf/>}{statementRows(data, fields, true).length ? <Table label={`${title}: histórico`} records={statementRows(data, fields, true)} /> : <p>Histórico N/D: no hay series disponibles para estas partidas.</p>}</details></article>)}</>;
}
export function GrowthHistory({
  data
}) {
  return <div className="analysis-history-grid">{[['Ingresos', 'revHistory'], ['Beneficio neto', 'niHistory'], ['BPA', 'epsHistory'], ['FCF', 'fcfHistory']].map(([label, key]) => {
      const points = growthPoints(data, key);
      const finite = points.filter(p => Number.isFinite(p.val));
      const min = Math.min(...finite.map(p => p.val));
      const max = Math.max(...finite.map(p => p.val));
      return <article className="analysis-card" key={key}><h3>{label}</h3>{finite.length > 1 && <svg viewBox="0 0 280 70" role="img" aria-label={`Evolución de ${label}; valores y periodos en el desplegable`}><polyline fill="none" stroke={C.green} strokeWidth="2.5" points={finite.map((p, i) => `${8 + i * 264 / (finite.length - 1)},${62 - (max === min ? 0.5 : (p.val - min) / (max - min)) * 54}`).join(' ')} /></svg>}<p>{finite.length ? `${financialText(finite.at(-1).val, finite.at(-1), data, key !== 'epsHistory')} · ${periodLabel(finite.at(-1))}` : 'Histórico N/D'}</p><details><summary>Ver valores y periodos</summary><ul>{points.map((p, i) => <li key={i}>{periodLabel(p)}: {financialText(p.val, p, data, key !== 'epsHistory')} · {p.source || 'Fuente individual N/D'}</li>)}</ul>{!points.length && <p>La fuente no aporta una serie utilizable.</p>}</details></article>;
    })}</div>;
}
