#!/usr/bin/env node
// Trusted local administration only. No network, credentials, database or publication command.
import {readFileSync,writeFileSync} from 'node:fs';
import {ReviewStore,projectForComparison} from '../lib/spanishFinancials/importer.js';
const [command,...args]=process.argv.slice(2), opts={};
for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]===undefined)throw Error('Expected --option value');opts[args[i].slice(2)]=args[i+1];}
const read=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
try {
 if(!opts.store)throw Error('--store is required (local directory)');
 const store=new ReviewStore(opts.store);let result;
 switch(command){
  case 'stage':result={version:store.stage(read(opts.manifest),readFileSync(opts.pdf),opts.actor)};break;
  case 'review':result=store.review(opts.id,opts.actor,opts.reason);break;
  case 'approve':result=store.approve(opts.id,opts.actor,opts.reason);break;
  case 'revoke':result=store.revoke(opts.id,opts.actor,opts.reason);break;
  // activate changes only the local comparison set; use a prior set to roll back.
  case 'activate':result=store.activate(opts.ids?opts.ids.split(','):[],opts.actor,opts.reason);break;
  case 'compare':result=store.compare(read(opts.snapshot));break;
  case 'preview':result={...projectForComparison(read(opts.snapshot),opts.ids.split(',').map(id=>store.read(id))),mode:'unapproved-preview',requiresApproval:true};break;
  case 'history':result=store.events();break;
  default:throw Error('Commands: stage, review, approve, revoke, activate, compare, preview, history');
 }
 if(opts.out)writeFileSync(opts.out,JSON.stringify(result,null,2),{flag:'wx'});else process.stdout.write(JSON.stringify(result,null,2)+'\n');
}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
