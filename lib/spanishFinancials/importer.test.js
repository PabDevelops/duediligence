import {describe,it,expect,afterEach} from 'vitest';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {ReviewStore,validateCandidate,hash,parseSpanishNumber,selectFacts,projectForComparison} from './importer.js';
const pdf=Buffer.from('%PDF-1.4\nSynthetic fixture only\n%%EOF');
const candidate=()=>({ticker:'BYTE.MC',isin:'ES0105817003',document:{url:'https://www.bytetravel.com/test-only-fixture.pdf',sha256:hash(pdf),pageCount:2,auditStatus:'audited',publicationDate:'2025-05-06'},facts:[{metric:'revenue',basis:'FY',periodStart:'2024-01-01',periodEnd:'2024-12-31',currency:'EUR',unit:'currency',scale:1,scope:'consolidated',page:1,rawValue:'1.000,00',excerpt:'Ingresos 1.000,00',extractionMethod:'manual-transcription',validationStatus:'transcribed'}]});
let dirs=[];afterEach(()=>{for(const dir of dirs)rmSync(dir,{recursive:true,force:true});dirs=[]});
const store=()=>{let dir=mkdtempSync(join(tmpdir(),'bulltrace-import-'));dirs.push(dir);return new ReviewStore(dir)};
describe('official financial import in comparison mode',()=>{
 it('normalizes explicit Spanish units and rejects ambiguous formats',()=>{expect(parseSpanishNumber('1.234,56')).toBe(1234.56);expect(()=>parseSpanishNumber('1,234.56')).toThrow();let c=candidate();c.facts[0].scale=1000;expect(validateCandidate(c,pdf).facts[0].value).toBe(1000000)});
 it('checks document fingerprints, identity and official hosts',()=>{const c=candidate();expect(()=>validateCandidate(c,Buffer.from('%PDF-other'))).toThrow();c.ticker='AAPL';expect(()=>validateCandidate(c,pdf)).toThrow();c.ticker='BYTE.MC';c.document.url='https://www.bytetravel.com.evil.test/doc.pdf';expect(()=>validateCandidate(c,pdf)).toThrow()});
 it.each(['page','scope','periodStart','currency','rawValue'])('rejects invalid or missing %s',key=>{let c=candidate();delete c.facts[0][key];expect(()=>validateCandidate(c,pdf)).toThrow()});
 it('rejects duplicate facts and ambiguous extractions',()=>{let c=candidate();c.facts.push(c.facts[0]);expect(()=>validateCandidate(c,pdf)).toThrow();c=candidate();c.facts[0].ambiguous=true;expect(()=>validateCandidate(c,pdf)).toThrow()});
 it('is idempotent, requires review/approval and preserves earlier versions on rollback',()=>{
 const s=store(),c=candidate(),a=s.stage(c,pdf,'test-operator');expect(s.stage(c,pdf,'test-operator')).toBe(a);expect(s.events()).toHaveLength(1);
 expect(()=>s.activate([a],'test-operator','activate')).toThrow();expect(()=>s.approve(a,'test-reviewer','approval')).toThrow();s.review(a,'test-reviewer','checked source page');s.approve(a,'test-reviewer','approved');s.activate([a],'test-reviewer','local comparison');expect(s.active()).toHaveLength(1);
 const c2=candidate();c2.facts[0].rawValue='2.000,00';c2.facts[0].excerpt='Ingresos 2.000,00';const b=s.stage(c2,pdf,'test-operator');s.review(b,'test-reviewer','source checked');s.approve(b,'test-reviewer','approved');s.activate([b],'test-reviewer','new version');expect(s.active()[0].facts[0].value).toBe(2000);s.activate([a],'test-reviewer','rollback');expect(s.active()[0].facts[0].value).toBe(1000);expect(s.read(b).facts[0].value).toBe(2000);
 s.revoke(a,'test-reviewer','source error');expect(s.active()).toHaveLength(0);expect(()=>s.activate([a],'test-reviewer','retry')).toThrow();
 });
 it('detects altered version files and journal entries',()=>{const s=store(),id=s.stage(candidate(),pdf,'test');writeFileSync(join(s.root,'versions',id+'.json'),'{}');expect(()=>s.read(id)).toThrow('tampered');const path=join(s.root,'events','0000000001.json');const e=JSON.parse(readFileSync(path));e.actor='altered';writeFileSync(path,JSON.stringify(e));expect(()=>s.events()).toThrow('tampered')});
 it('never replaces audited facts with preliminary ones and rejects equal-rank conflicts',()=>{
 const a=validateCandidate(candidate(),pdf),b=structuredClone(a);b.document.auditStatus='preliminary';b.facts[0].value=2;expect(selectFacts([b,a])[0].value).toBe(1000);b.document.auditStatus='audited';expect(()=>selectFacts([a,b])).toThrow('conflict');
 });
 it('keeps semestrals separate from annual histories',()=>{let c=validateCandidate(candidate(),pdf);let h={...c.facts[0],basis:'H1',periodStart:'2025-01-01',periodEnd:'2025-06-30',value:200};c.facts.push(h);const d=projectForComparison({ticker:'BYTE.MC',currency:'EUR',currentPrice:4.6},[c]);expect(d.mode).toBe('comparison-only');expect(d.publicationEnabled).toBe(false);expect(d.proposal.revHistory).toHaveLength(1);expect(d.proposal.interimFinancials).toHaveLength(1);expect(d.proposal.fcfVal).toBeNull();expect(d.proposal.eps).toBeUndefined()});
});
