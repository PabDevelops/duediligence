import {describe,it,expect} from 'vitest';
import {financialCoverageBadge} from './financialCoverageBadge';
const scores=coverage=>['growth','value','quality'].map(id=>({id,coverage,score100:50}));
describe('financial shield has an explicit, limited meaning',()=>{
 it('shows high coverage at exactly 90% in all three dimensions',()=>expect(financialCoverageBadge(scores(.9)).label).toBe('Cobertura alta'));
 it('does not award a badge to incomplete or unavailable dimensions',()=>{
  expect(financialCoverageBadge(scores(.899))).toBeNull();
  expect(financialCoverageBadge([...scores(.99).slice(0,2),{coverage:1,score100:null}])).toBeNull();
  expect(financialCoverageBadge([])).toBeNull();
 });
 it('does not equate completeness with audited or verified financial statements',()=>{
  expect(financialCoverageBadge(scores(1)).description).toContain('no equivale a una auditoría');
 });
 it('does not award automatic high coverage with known contradictions',()=>{
  expect(financialCoverageBadge(scores(1),{financialIntegrity:{fields:{pe:{status:'blocked',reason:'PER incompatible'}}}})).toBeNull();
 });
 it('labels a manual correction without implying that the whole company is verified',()=>{
  const b=financialCoverageBadge(scores(.4),{manualCorrections:[{field:'rdVal'}]});
  expect(b.label).toBe('Con correcciones manuales');expect(b.description).toContain('no verifica todas');
 });
});
