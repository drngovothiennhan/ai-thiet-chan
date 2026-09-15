(()=>{
  function makeCollapsible(card,{buttonId,openText,closeText,eventName}){
    if(!card||card.dataset.aitcCollapsible==='1')return;
    card.dataset.aitcCollapsible='1';
    const head=card.querySelector(':scope > .section-head');if(!head)return;
    const body=document.createElement('div');body.className='aitc-collapsible-body';body.hidden=true;
    [...card.children].filter(n=>n!==head).forEach(n=>body.appendChild(n));
    card.appendChild(body);
    let btn=head.querySelector(`#${buttonId}`);
    if(!btn){btn=document.createElement('button');btn.id=buttonId;btn.className='btn ghost compact aitc-section-toggle';btn.type='button';btn.textContent=openText;head.appendChild(btn);}
    btn.setAttribute('aria-expanded','false');
    btn.addEventListener('click',()=>{
      const opening=body.hidden;body.hidden=!opening;btn.textContent=opening?closeText:openText;btn.setAttribute('aria-expanded',String(opening));
      if(opening&&eventName)window.dispatchEvent(new CustomEvent(eventName));
    });
  }
  function apply(){
    makeCollapsible(document.querySelector('.quality-card'),{buttonId:'qualityToggleBtn',openText:'Xem',closeText:'Ẩn',eventName:'aitc:quality-open'});
    makeCollapsible(document.getElementById('clinicalFeedbackCard'),{buttonId:'clinicalFeedbackToggleBtn',openText:'Xem góp ý',closeText:'Ẩn góp ý',eventName:'aitc:clinical-feedback-open'});
  }
  apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
})();
