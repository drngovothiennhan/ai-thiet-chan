(()=>{
  const specs=[
    {inputId:'topFileInput',buttonId:'topUploadBtn',label:'Tải ảnh mặt trên'},
    {inputId:'bottomFileInput',buttonId:'bottomUploadBtn',label:'Tải ảnh mặt dưới'}
  ];

  function install({inputId,buttonId,label}){
    const input=document.getElementById(inputId);
    if(!input||document.getElementById(buttonId))return;
    const legacy=input.closest('label.file-btn');
    const host=legacy?.parentElement||input.parentElement;
    if(!host)return;

    if(legacy){
      legacy.insertAdjacentElement('afterend',input);
      legacy.remove();
    }
    input.hidden=true;
    input.setAttribute('accept','image/*');
    input.removeAttribute('capture');

    const btn=document.createElement('button');
    btn.id=buttonId;
    btn.type='button';
    btn.className='btn upload-image-btn';
    btn.textContent=`⇧ ${label}`;
    btn.setAttribute('aria-controls',inputId);
    btn.setAttribute('aria-label',`${label} có sẵn từ thiết bị`);
    btn.addEventListener('click',()=>input.click());

    const reset=host.querySelector('[id$="ResetBtn"]');
    if(reset)host.insertBefore(btn,reset);else host.appendChild(btn);
  }

  function apply(){for(const spec of specs)install(spec);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
