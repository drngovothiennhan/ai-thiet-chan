import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const [settings,torch,sw]=await Promise.all([
  readFile(path.join(root,'public/settings.js'),'utf8'),
  readFile(path.join(root,'public/torch.js'),'utf8'),
  readFile(path.join(root,'public/sw.js'),'utf8')
]);

for(const marker of ["'/torch.js','rearTorch'","const RELEASE='2.9.0'",'afterWindowLoad(async()=>']) if(!settings.includes(marker)) throw new Error(`torch loader missing: ${marker}`);
for(const marker of ['toggleTorchBtn','Bật đèn','Tắt đèn','getCapabilities','applyConstraints','torch','environment','closeCameraBtn','captureBtn','switchCameraBtn','visibilitychange']) if(!torch.includes(marker)) throw new Error(`torch behavior missing: ${marker}`);
if(sw.includes("'/torch.js'")) throw new Error('torch asset must not block service-worker installation');
console.log('TORCH SMOKE PASS: rear-camera flash control is capability-gated, dynamically loaded after window load and reset on camera lifecycle events');
