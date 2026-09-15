// Bound the entire exchange, including a response body that stops arriving.
export async function boundedFetch(fetcher,input,init={},timeoutMs=15000,maxBytes=4*1024*1024){
  const controller=new AbortController();
  const upstream=init.signal||input?.signal;
  const cancel=()=>controller.abort(upstream.reason);
  if(upstream?.aborted) cancel();
  else upstream?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>controller.abort(Object.assign(new Error('UPSTREAM_TIMEOUT'),{status:504})),timeoutMs);
  let reader;
  let rejectAbort;
  const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason);});
  controller.signal.addEventListener('abort',rejectAbort,{once:true});
  try{
    controller.signal.throwIfAborted();
    const response=await Promise.race([fetcher(input,{...init,signal:controller.signal}),aborted]);
    if(!response.body)return response;
    reader=response.body.getReader();
    const chunks=[];let size=0;
    while(true){
      const {done,value}=await Promise.race([reader.read(),aborted]);
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes)throw Object.assign(new Error('UPSTREAM_RESPONSE_TOO_LARGE'),{status:502});
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const headers=new Headers(response.headers);
    headers.delete('content-encoding');headers.delete('content-length');
    return new Response(bytes,{status:response.status,statusText:response.statusText,headers});
  }catch(error){
    controller.abort(error);
    if(reader)void reader.cancel(error).catch(()=>{});
    throw error;
  }finally{
    clearTimeout(timer);
    upstream?.removeEventListener('abort',cancel);
    controller.signal.removeEventListener('abort',rejectAbort);
  }
}
