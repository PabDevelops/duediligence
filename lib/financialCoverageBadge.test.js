import {describe,it,expect} from 'vitest';
import {financialCoverageBadge} from './financialCoverageBadge';
const scores=coverage=>['growth','value','quality'].map(id=>({id,coverage,score100:50}));
describe('financial shield has an explicit, limited meaning',()=>{
 it('uses the mean above 80%, including 100/100/85',()=>{
  const s=scores(1);s[2].coverage=.85;
  expect(financialCoverageBadge(s)).toMatchObject({kind:'coverage',label:'Cobertura alta',description:expect.stringContaining('media 95%')});
  expect(financialCoverageBadge(scores(.899)).kind).toBe('coverage');
 });
 it('does not award a badge at or below 80%, or with missing/invalid dimensions',()=>{
  expect(financialCoverageBadge(scores(.8))).toBeNull();expect(financialCoverageBadge(scores(.79))).toBeNull();
  expect(financialCoverageBadge(scores(NaN))).toBeNull();expect(financialCoverageBadge(scores(1.1))).toBeNull();
  expect(financialCoverageBadge([scores(1)[0],scores(1)[0],scores(1)[2]])).toBeNull();
  expect(financialCoverageBadge([])).toBeNull();
 });
 it('prioritizes coverage over manual corrections while retaining their disclosure',()=>{
  const b=financialCoverageBadge(scores(.9),{manualCorrections:[{field:'rdVal'}]});
  expect(b.kind).toBe('coverage');expect(b.description).toContain('1 partida corregida por administración');
 });
 it('does not confuse average coverage with each dimension having a definitive score',()=>{
  const s=scores(1);s[2]={id:'quality',coverage:.5,score100:null};
  expect(financialCoverageBadge(s).description).toContain('no tiene nota definitiva');
 });
 it('does not hide blocking contradictions when coverage and manual corrections coexist',()=>{
  const b=financialCoverageBadge(scores(1),{manualCorrections:[{}],financialIntegrity:{issues:[{severity:'error'}]}});
  expect(b.kind).toBe('manual');expect(b.description).toContain('incompatibles');
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
