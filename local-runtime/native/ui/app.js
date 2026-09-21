(()=>{
  'use strict';
  const runtimeEl=document.getElementById('runtime');
  const queueEl=document.getElementById('queue');
  const hashEl=document.getElementById('hash');
  const invoke=window.__TAURI__?.core?.invoke;
  const pretty=value=>JSON.stringify(value,null,2);
  async function call(command,args){
    if(typeof invoke!=='function')throw new Error('TAURI_BRIDGE_UNAVAILABLE');
    return invoke(command,args);
  }
  async function refresh(){
    try{
      const [status,probe,queue]=await Promise.all([call('runtime_status'),call('device_probe'),call('queue_list')]);
      runtimeEl.textContent=pretty({status,probe});
      queueEl.textContent=pretty(queue.jobs||[]);
    }catch(err){runtimeEl.textContent=`Runtime error: ${String(err?.message||err)}`;}
  }
  document.getElementById('refresh').addEventListener('click',refresh);
  document.getElementById('image').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file){hashEl.textContent='Chưa chọn ảnh.';return;}
    try{
      const bytes=[...new Uint8Array(await file.arrayBuffer())];
      const digest=await call('sha256_bytes',{bytes});
      hashEl.textContent=`${file.name} · ${file.size} bytes · sha256 ${digest}`;
    }catch(err){hashEl.textContent=`Không thể băm ảnh: ${String(err?.message||err)}`;}
  });
  refresh();
})();
