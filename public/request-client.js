(()=>{
  'use strict';
  if(window.AITCRequestClient)return;

  const VERSION='request-client-v1';
  const rawFetch=window.fetch.bind(window);
  const layers=new Map();
  let sequence=0;
  let sealed=false;
  let total=0;
  let rawCalls=0;

  function ordered(){
    return [...layers.values()].sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);
  }
  function invoke(chain,index,input,init){
    const layer=chain[index];
    if(!layer){rawCalls+=1;return rawFetch(input,init);}
    return layer.handler(input,init);
  }
  function fetchAfter(name,input,init){
    const chain=ordered();
    const index=chain.findIndex(layer=>layer.name===name);
    if(index<0)throw new Error(`AITC_REQUEST_LAYER_NOT_REGISTERED:${name}`);
    return invoke(chain,index+1,input,init);
  }
  function register(name,handler,priority){
    if(sealed)throw new Error('AITC_REQUEST_PIPELINE_SEALED');
    const key=String(name||'').trim();
    if(!key||typeof handler!=='function'||!Number.isFinite(Number(priority)))throw new TypeError('AITC_REQUEST_LAYER_INVALID');
    if(layers.has(key))throw new Error(`AITC_REQUEST_LAYER_DUPLICATE:${key}`);
    layers.set(key,Object.freeze({name:key,handler,priority:Number(priority),sequence:sequence++}));
    return true;
  }
  const pipelineFetch=(input,init)=>{
    total+=1;
    return invoke(ordered(),0,input,init);
  };
  function seal(){
    if(sealed)return true;
    try{
      const descriptor=Object.getOwnPropertyDescriptor(window,'fetch');
      if(descriptor?.configurable===false&&descriptor?.value!==pipelineFetch)return false;
      Object.defineProperty(window,'fetch',{value:pipelineFetch,writable:false,configurable:false,enumerable:true});
      sealed=true;
      return true;
    }catch{return false;}
  }
  function snapshot(){
    return Object.freeze({version:VERSION,sealed,total,rawCalls,layers:ordered().map(layer=>layer.name)});
  }

  window.fetch=pipelineFetch;
  window.AITCRequestClient=Object.freeze({version:VERSION,register,fetchAfter,rawFetch,pipelineFetch,seal,snapshot});
})();
