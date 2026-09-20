(()=>{
  'use strict';
  const KEY='aitc-layout-mode-v1';
  const root=document.documentElement;
  const btn=document.getElementById('layoutModeBtn');
  function initial(){
    try{const saved=localStorage.getItem(KEY);if(saved==='mobile'||saved==='desktop')return saved;}catch{}
    return matchMedia('(max-width:760px)').matches?'mobile':'desktop';
  }
  function paint(mode,{persist=false}={}){
    const next=mode==='desktop'?'desktop':'mobile';
    root.dataset.aitcLayout=next;
    document.body?.setAttribute('data-aitc-layout',next);
    if(btn){
      btn.querySelector('.layout-mode-label').textContent=next==='mobile'?'PC':'Mobile';
      btn.setAttribute('aria-label',next==='mobile'?'Chuyển sang giao diện PC/Desktop':'Chuyển sang giao diện Mobile');
      btn.setAttribute('title',next==='mobile'?'Giao diện PC/Desktop':'Giao diện Mobile');
    }
    if(persist){try{localStorage.setItem(KEY,next);}catch{}}
    window.dispatchEvent(new CustomEvent('aitc:layout-change',{detail:{mode:next}}));
    return next;
  }
  let mode=paint(initial());
  btn?.addEventListener('click',()=>{mode=paint(mode==='mobile'?'desktop':'mobile',{persist:true});});
  window.AITCLayoutMode=Object.freeze({get:()=>mode,set:value=>{mode=paint(value,{persist:true});return mode;}});
})();