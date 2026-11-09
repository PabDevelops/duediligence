// A slow section must neither block its neighbours nor leave a spinner forever.
export async function fetchPublicJSON(url,{signal,timeoutMs=15000}={}){
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,timeoutMs);
 try{
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw new Error('No se pudieron cargar los datos.');
  const data=await response.json();
  if(data.error)throw new Error('No se pudieron cargar los datos.');
  return data;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
