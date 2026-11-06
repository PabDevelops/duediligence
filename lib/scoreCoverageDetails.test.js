import {it,expect} from 'vitest';
import {scoreCoverageDetails} from './scoreCoverageDetails';
const score=(id,parts)=>({id,components:parts.map(([id,score])=>({id,score,weight:.4,label:id}))});
it('distinguishes missing data from a non-applicable multiple and preserves weights and scores',()=>{
 const s=score('value',[['pe',null],['pfcf',null],['evEbit',55]]),before=structuredClone(s);
 const parts=scoreCoverageDetails(s,{niVal:-1,fcfVal:100,sbcVal:20,marketCap:1000});
 expect(parts[0]).toMatchObject({status:'Descartado',reason:'El beneficio neto no es positivo.'});
 expect(parts[1].status).toBe('Falta información'); // diagnostic follows actual score availability, never invents a ratio
 expect(parts[2].status).toBe('Calculado');expect(s).toEqual(before);
});
it('shows actual manual periods and does not claim automatic verification',()=>{
 const parts=scoreCoverageDetails(score('quality',[['returns',60]]),{roic:10,financialPeriods:{roic:{basis:'H1',periodStart:'2026-01-01',periodEnd:'2026-06-30',currency:'USD'}},manualCalculation:{fields:['roic']}});
 expect(parts[0].status).toBe('Calculado · entrada manual');expect(parts[0].inputs[0].period).toContain('01/01/2026–30/06/2026');
});
it('identifies missing historical requirements and excluded incompatible inputs',()=>{
 const parts=scoreCoverageDetails(score('quality',[['marginStability',null],['operatingMargin',null]]),{financialIntegrity:{fields:{opMargin:{modelExcluded:true,reason:'Periodos incompatibles'}}}});
 expect(parts[0].action).toContain('cuatro ejercicios coincidentes');expect(parts[0].reason).toContain('Histórico');
 expect(parts[1]).toMatchObject({status:'Descartado',reason:'Periodos incompatibles'});
});
it('does not require SBC to calculate the existing unadjusted P/FCF branch',()=>{
 const part=scoreCoverageDetails(score('value',[['pfcf',50]]),{fcfVal:100,marketCap:1000})[0];
 expect(part.inputs.map(i=>i.field)).toEqual(['marketCap','fcfVal']);expect(part.status).toBe('Calculado');
});
it('explains the real three-observation historical-growth minimum and the available margin years',()=>{
 const data={revHistory:[{year:'2024',val:10},{year:'2025',val:20}],oiHistory:[{year:'2025',val:3}]};
 expect(scoreCoverageDetails(score('growth',[['historicalRevenue',null]]),data)[0].action).toContain('tres ejercicios');
 const margin=scoreCoverageDetails(score('quality',[['marginStability',null]]),data)[0];
 expect(margin.reason).toContain('disponibles: 2025');expect(margin.periodUsed).toBe('No utilizado');
});
