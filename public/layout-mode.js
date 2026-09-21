(()=>{
  'use strict';
  const SESSION_KEY='aitc-layout-mode-session-v2';
  const LEGACY_KEY='aitc-layout-mode-v1';
  const MOBILE_QUERY='(max-width:760px)';
  const root=document.documentElement;
  const btn=document.getElementById('layoutModeBtn');
  const mq=matchMedia(MOBILE_QUERY);

  function naturalMode(){return mq.matches?'mobile':'desktop';}
  function savedMode(){
    try{
      const value=sessionStorage.getItem(SESSION_KEY);
      return value==='mobile'||value==='desktop'?value:'';
    }catch{return '';}
  }
  try{localStorage.removeItem(LEGACY_KEY);}catch{}

  let manual=Boolean(savedMode());
  function initial(){return savedMode()||naturalMode();}

  function paint(mode,{persist=false,source='system'}={}){
    const next=mode==='desktop'?'desktop':'mobile';
    const width=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    root.dataset.aitcLayout=next;
    root.dataset.aitcViewport=width>=1024?'wide':width>=621?'compact':'narrow';
    document.body?.setAttribute('data-aitc-layout',next);
    document.body?.setAttribute('data-aitc-viewport',root.dataset.aitcViewport);
    if(btn){
      const label=btn.querySelector('.layout-mode-label');
      if(label)label.textContent=next==='mobile'?'PC':'Mobile';
      btn.setAttribute('aria-label',next==='mobile'?'Chuyển sang giao diện PC/Desktop':'Chuyển sang giao diện Mobile');
      btn.setAttribute('title',next==='mobile'?'Giao diện PC/Desktop':'Giao diện Mobile');
      btn.setAttribute('aria-pressed',next==='desktop'?'true':'false');
    }
    if(persist){
      manual=true;
      try{sessionStorage.setItem(SESSION_KEY,next);}catch{}
    }
    window.dispatchEvent(new CustomEvent('aitc:layout-change',{detail:{mode:next,viewport:root.dataset.aitcViewport,source}}));
    return next;
  }

  let mode=paint(initial(),{source:'initial'});
  btn?.addEventListener('click',()=>{mode=paint(mode==='mobile'?'desktop':'mobile',{persist:true,source:'manual'});});

  const refreshViewport=()=>{
    if(!manual){
      const natural=naturalMode();
      if(natural!==mode)mode=paint(natural,{source:'responsive'});
      else paint(mode,{source:'responsive'});
    }else paint(mode,{source:'viewport'});
  };
  if(typeof mq.addEventListener==='function')mq.addEventListener('change',refreshViewport);
  window.addEventListener('resize',()=>requestAnimationFrame(refreshViewport),{passive:true});

  window.AITCLayoutMode=Object.freeze({
    get:()=>mode,
    set:value=>{mode=paint(value,{persist:true,source:'api'});return mode;},
    reset:()=>{
      manual=false;
      try{sessionStorage.removeItem(SESSION_KEY);}catch{}
      mode=paint(naturalMode(),{source:'reset'});
      return mode;
    }
  });
})();