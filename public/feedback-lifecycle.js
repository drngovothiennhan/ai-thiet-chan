(()=>{
  const CARD_ID='clinicalFeedbackCard';
  const STATUS_ID='clinicalFeedbackStatus';
  const TOGGLE_ID='clinicalFeedbackToggleBtn';
  let statusObserver=null;

  function card(){return document.getElementById(CARD_ID);}
  function toggle(){return document.getElementById(TOGGLE_ID);}

  function hideSubmittedFeedback(){
    const c=card();
    if(!c)return;
    c.hidden=true;
    c.dataset.feedbackSubmitted='true';
    const t=toggle();
    if(t){t.hidden=true;t.setAttribute('aria-expanded','false');t.textContent='Xem góp ý';}
  }

  function reopenForNewCase(){
    const c=card();
    if(!c)return;
    c.hidden=false;
    delete c.dataset.feedbackSubmitted;
    const body=c.querySelector('.aitc-collapsible-body');
    if(body)body.hidden=true;
    const t=toggle();
    if(t){t.hidden=false;t.setAttribute('aria-expanded','false');t.textContent='Xem góp ý';}
    const form=document.getElementById('clinicalFeedbackForm');
    if(form)form.reset();
    const status=document.getElementById(STATUS_ID);
    if(status){status.hidden=true;status.textContent='';status.className='clinical-learning-status';}
  }

  function bindStatusObserver(){
    const status=document.getElementById(STATUS_ID);
    if(!status||status.dataset.feedbackLifecycleBound==='true')return;
    status.dataset.feedbackLifecycleBound='true';
    statusObserver=new MutationObserver(()=>{
      if(status.textContent.trim().startsWith('Đã gửi về admin'))hideSubmittedFeedback();
    });
    statusObserver.observe(status,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
  }

  const domObserver=new MutationObserver(bindStatusObserver);
  domObserver.observe(document.body,{childList:true,subtree:true});
  bindStatusObserver();

  const previousFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    const response=await previousFetch(input,init);
    if(url.includes('/api/analyze')&&method==='POST'&&response.ok){
      queueMicrotask(()=>{bindStatusObserver();reopenForNewCase();});
    }
    return response;
  };
})();
