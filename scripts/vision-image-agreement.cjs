// Local-only engineering probe. Never uploads the input image or changes production.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../public');
const imagePath=process.argv[2],outputPath=process.argv[3];
if(!imagePath)throw new Error('Usage: node scripts/vision-image-agreement.cjs <image> [report.json]');
const {chromium}=require(process.env.AITC_PLAYWRIGHT_MODULE||'playwright');
const input=fs.readFileSync(imagePath);
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/probe'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<meta charset="utf-8">Local vision probe');}
  if(url.pathname==='/input'){res.setHeader('Content-Type','application/octet-stream');return res.end(input);}
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'application/json; charset=utf-8');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.AITC_CHROMIUM_PATH?{executablePath:process.env.AITC_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/probe');
    await page.addScriptTag({url:'/academic-vision.js'});
    await page.addScriptTag({url:'/local-vision/model-manifest.js'});
    await page.addScriptTag({url:'/local-vision/shadow-pixel-mlp.js'});
    const report=await page.evaluate(async()=>{
      const blob=await(await fetch('/input')).blob(),bitmap=await createImageBitmap(blob);
      const original=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob);});
      const variants=[{id:'original'},...[.90,.95,1.05,1.10].map(v=>({id:'brightness-'+v,brightness:v})),
        ...[.90,1.10].map(v=>({id:'contrast-'+v,contrast:v})),...[.90,1.10].map(v=>({id:'saturation-'+v,saturation:v})),
        ...[[1.03,1,1],[.97,1,1],[1,1.03,1],[1,.97,1],[1,1,1.03],[1,1,.97]].map((v,i)=>({id:'channel-'+i,gains:v})),
        ...[.50,.65,.80,.95].map(v=>({id:'jpeg-'+v,jpeg:v})),...[-2,-1,1,2].map(v=>({id:'rotation-'+v,angle:v})),
        ...[.01,.02,.03,.04].map(v=>({id:'symmetric-crop-'+v,crop:v})),...[.5,.75].map(v=>({id:'scale-'+v,scale:v}))];
      const target={bodyColorCandidate:'đỏ nhạt',coatingThicknessCandidate:'mỏng',coatingDistributionCandidate:'trung tâm–sau',medianSulcusVisible:true};
      const rows=[];
      for(const variant of variants){
        let data=original;
        if(variant.id!=='original'){
          const canvas=document.createElement('canvas'),scale=variant.scale||1;
          canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
          const c=canvas.getContext('2d',{willReadFrequently:true});
          c.fillStyle='#888';c.fillRect(0,0,canvas.width,canvas.height);
          c.translate(canvas.width/2,canvas.height/2);c.rotate((variant.angle||0)*Math.PI/180);
          c.filter=`brightness(${variant.brightness||1}) contrast(${variant.contrast||1}) saturate(${variant.saturation||1})`;
          const crop=variant.crop||0;
          c.drawImage(bitmap,bitmap.width*crop,bitmap.height*crop,bitmap.width*(1-2*crop),bitmap.height*(1-2*crop),-canvas.width/2,-canvas.height/2,canvas.width,canvas.height);
          if(variant.gains){const pixels=c.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<pixels.data.length;i+=4)for(let k=0;k<3;k++)pixels.data[i+k]*=variant.gains[k];c.putImageData(pixels,0,0);}
          data=variant.jpeg?canvas.toDataURL('image/jpeg',variant.jpeg):canvas.toDataURL('image/png');
        }
        const sig=await AITCAcademicVision.signatureFromDataUrl(data),s=sig?.spatial;
        const actual={bodyColorCandidate:s?.bodyColorCandidate??null,coatingThicknessCandidate:s?.coatingThicknessCandidate??null,coatingDistributionCandidate:s?.coatingDistributionCandidate??null,medianSulcusVisible:s?.medianSulcus?.visibleSignal??null};
        const matches=Object.fromEntries(Object.keys(target).map(k=>[k,actual[k]===target[k]]));
        rows.push({variant:variant.id,actual,matches,exact:Object.values(matches).every(Boolean),fissurePolicy:s?.fissurePolicy??null});
      }
      const roi=await AITCLocalVisionShadow.analyzeDataUrl(original,'top');
      const {analyzeShadowFeatureCandidates}=await import('/local-vision/shadow-feature-extractor.js');
      const shadow=await analyzeShadowFeatureCandidates(original,'top',{roiGeometry:roi.roiGeometry});
      bitmap.close();
      const passed=rows.filter(x=>x.exact).length;
      return {schemaVersion:'aitc-single-image-perturbation-v1',semantics:'Engineering agreement with four predeclared assistant observations for ONE development image; correlated variants, not independent cases or diagnostic accuracy.',independentImages:1,target,variantCount:rows.length,exactMatchCount:passed,exactAgreement:passed/rows.length,perField:Object.fromEntries(Object.keys(target).map(k=>[k,rows.filter(r=>r.matches[k]).length/rows.length])),clinicalAccuracy:null,productionActivation:'none',rows,shadow:{roiGeometry:roi.roiGeometry,status:shadow.status,reason:shadow.reason??null,authority:shadow.authority}};
    });
    report.browser=browser.version();
    const text=JSON.stringify(report,null,2)+'\n';if(outputPath)fs.writeFileSync(outputPath,text);else process.stdout.write(text);
    console.log(JSON.stringify({variants:report.variantCount,exact:report.exactMatchCount,agreement:report.exactAgreement,perField:report.perField,shadow:report.shadow}));
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
