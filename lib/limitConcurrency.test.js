import {it,expect} from 'vitest';
import {limitConcurrency} from './limitConcurrency';
it('shares two slots across batches, preserves ordering and releases rejected work',async()=>{
 const limit=limitConcurrency(2);let active=0,peak=0;
 const batch=offset=>Promise.allSettled(Array.from({length:6},(_,i)=>limit(async()=>{
  active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;if(i===2)throw Error('offline');return offset+i;
 })));
 const [a,b]=await Promise.all([batch(0),batch(10)]);expect(peak).toBe(2);expect(active).toBe(0);expect(a.map(r=>r.status)).toEqual(['fulfilled','fulfilled','rejected','fulfilled','fulfilled','fulfilled']);expect(b[5].value).toBe(15);
 expect(await limit(()=>42)).toBe(42);
});
