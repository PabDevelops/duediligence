import {it,expect,vi,afterEach} from 'vitest';
import {fetchPublicJSON} from './fetchPublicJSON';
afterEach(()=>vi.useRealTimers());
it('returns good data and rejects HTTP failures and error payloads',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({stocks:[1]})})));expect(await fetchPublicJSON('/good')).toEqual({stocks:[1]});
 fetch.mockResolvedValueOnce({ok:false});await expect(fetchPublicJSON('/unavailable')).rejects.toThrow();
 fetch.mockResolvedValueOnce({ok:true,json:async()=>({error:'unavailable'})});await expect(fetchPublicJSON('/bad-body')).rejects.toThrow();
});
it('aborts a section that never resolves instead of leaving an infinite spinner',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))));
 const promise=fetchPublicJSON('/slow',{timeoutMs:20});const check=expect(promise).rejects.toMatchObject({name:'AbortError'});await vi.advanceTimersByTimeAsync(21);await check;
});
