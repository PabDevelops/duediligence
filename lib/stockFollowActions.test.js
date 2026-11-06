import {describe,it,expect,vi} from 'vitest';
import {saveStockFollow,removeStockFollow} from './stockFollowActions';
const fetcher = () => vi.fn(async()=>({ok:true,json:async()=>({success:true})}));
describe('follow choices use the existing authenticated watchlist routes',()=>{
 it('follows a new ticker in the selected basket',async()=>{
  const f=fetcher();await saveStockFollow('TBLA','Growth',false,f);
  expect(f).toHaveBeenCalledWith('/api/watchlist',expect.objectContaining({method:'POST',body:JSON.stringify({ticker:'TBLA',pie:'Growth'})}));
 });
 it('moves an existing follow with PATCH instead of deleting and recreating it',async()=>{
  const f=fetcher();await saveStockFollow('TBLA','Value',true,f);
  expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][1].method).toBe('PATCH');
  expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ticker:'TBLA',pie:'Value'});
 });
 it('represents the unassigned General group as null',async()=>{
  const f=fetcher();await saveStockFollow('TBLA','',true,f);
  expect(JSON.parse(f.mock.calls[0][1].body).pie).toBeNull();
 });
 it('preserves legacy basket names exactly',async()=>{
  const f=fetcher();await saveStockFollow('TBLA',' Value ',true,f);
  expect(JSON.parse(f.mock.calls[0][1].body).pie).toBe(' Value ');
 });
 it('only removes the selected ticker, never a basket or user-supplied account',async()=>{
  const f=fetcher();await removeStockFollow('TBLA',f);
  expect(f.mock.calls[0][1].method).toBe('DELETE');
  expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ticker:'TBLA'});
 });
 it('propagates limits and failures rather than claiming success',async()=>{
  const f=vi.fn(async()=>({ok:false,json:async()=>({error:'Límite de seguimiento'})}));
  await expect(saveStockFollow('TBLA','Growth',false,f)).rejects.toThrow('Límite de seguimiento');
  await expect(removeStockFollow('TBLA',async()=>{throw new Error('Sin conexión');})).rejects.toThrow('Sin conexión');
 });
});
