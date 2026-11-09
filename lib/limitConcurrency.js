// Shared by callers in this server instance. Failed work releases its slot too.
export function limitConcurrency(limit) {
 let active=0;
 const waiting=[];
 const run=()=>{
  while(active<limit&&waiting.length){
   const {work,resolve,reject}=waiting.shift();active++;
   Promise.resolve().then(work).then(resolve,reject).finally(()=>{active--;run();});
  }
 };
 return work=>new Promise((resolve,reject)=>{waiting.push({work,resolve,reject});run();});
}
