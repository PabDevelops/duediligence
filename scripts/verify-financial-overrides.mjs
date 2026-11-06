const {PGlite}=await import(process.env.BULLTRACE_SQL_TEST_MODULE||'@electric-sql/pglite');
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('11111111-1111-1111-1111-111111111111');`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261106133037_admin_financial_overrides.sql',import.meta.url),'utf8'));
const check=(value)=>{assert(value);checks++;};
for(const role of ['anon','authenticated'])for(const table of ['financial_override_revisions','current_financial_overrides']){const r=await db.query('select has_table_privilege($1,$2,$3) as allowed',[role,'public.'+table,'SELECT']);check(!r.rows[0].allowed);}
const rls=await db.query("select relrowsecurity from pg_class where oid='public.financial_override_revisions'::regclass");check(rls.rows[0].relrowsecurity);
const invoker=await db.query("select prosecdef from pg_proc where proname='set_financial_override'");check(!invoker.rows[0].prosecdef);
await db.exec('set role service_role');
const write=async(value,active,id)=> (await db.query('select public.set_financial_override($1,$2,$3,$4,$5,$6,$7) as id',['TEST','rdVal',value,{},active,'11111111-1111-1111-1111-111111111111',id])).rows[0].id;
const a=await write(20,true,0);check(a>0);
try{await write(30,true,0);assert.fail('conflict accepted');}catch(e){check(e.code==='40001');}
const b=await write(40,true,a);check(b>a);
let current=await db.query('select * from public.current_financial_overrides');check(current.rows.length===1&&current.rows[0].value===40);
await write(null,false,b);current=await db.query('select * from public.current_financial_overrides');check(current.rows.length===1&&!current.rows[0].active);
const history=await db.query('select count(*)::int as n from public.financial_override_revisions');check(history.rows[0].n===3);
try{await db.exec('delete from public.financial_override_revisions');assert.fail('delete allowed');}catch(e){check(e.code==='42501');}
await db.exec('reset role;set role anon');
try{await write(50,true,0);assert.fail('anon RPC allowed');}catch(e){check(e.code==='42501');}
await db.close();console.log(JSON.stringify({database:'PGlite in-memory PostgreSQL',migration:'passed',checks,hostedChanges:0}));


