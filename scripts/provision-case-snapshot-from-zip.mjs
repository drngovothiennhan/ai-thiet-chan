import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const bundleUrl=String(process.env.AITC_CASE_BUNDLE_URL||'').trim();
const bundleSha=String(process.env.AITC_CASE_BUNDLE_SHA256||'').replace(/^sha256:/i,'').trim().toLowerCase();
const expectedDbSha=String(process.env.AITC_CASE_EXPECTED_SHA256||'68aa881b8e0c31935b8040095d2277d2940a55874209b7458d1433eb6b01781e').trim().toLowerCase();
const output=path.resolve(String(process.env.AITC_CASE_RETRIEVAL_DB||'runtime-data/AITC-LLM-Case-Reasoning-v1.sqlite'));
const entryName='index/AITC-LLM-Case-Reasoning-v1.sqlite';

function sha256(buf){return createHash('sha256').update(buf).digest('hex');}
function findEocd(buf){
  for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--) if(buf.readUInt32LE(i)===0x06054b50) return i;
  throw new Error('ZIP_EOCD_NOT_FOUND');
}
function extractEntry(buf,name){
  const eocd=findEocd(buf);
  const cdSize=buf.readUInt32LE(eocd+12),cdOffset=buf.readUInt32LE(eocd+16);
  let p=cdOffset;
  while(p<cdOffset+cdSize){
    if(buf.readUInt32LE(p)!==0x02014b50) throw new Error('ZIP_CENTRAL_DIRECTORY_INVALID');
    const method=buf.readUInt16LE(p+10),compressedSize=buf.readUInt32LE(p+20),uncompressedSize=buf.readUInt32LE(p+24);
    const nameLen=buf.readUInt16LE(p+28),extraLen=buf.readUInt16LE(p+30),commentLen=buf.readUInt16LE(p+32),localOffset=buf.readUInt32LE(p+42);
    const entry=buf.subarray(p+46,p+46+nameLen).toString('utf8');
    if(entry===name){
      if(buf.readUInt32LE(localOffset)!==0x04034b50) throw new Error('ZIP_LOCAL_HEADER_INVALID');
      const localNameLen=buf.readUInt16LE(localOffset+26),localExtraLen=buf.readUInt16LE(localOffset+28);
      const start=localOffset+30+localNameLen+localExtraLen;
      const compressed=buf.subarray(start,start+compressedSize);
      const data=method===0?Buffer.from(compressed):method===8?inflateRawSync(compressed):null;
      if(!data) throw new Error(`ZIP_COMPRESSION_UNSUPPORTED_${method}`);
      if(data.length!==uncompressedSize) throw new Error(`SQLITE_SIZE_MISMATCH_${data.length}_${uncompressedSize}`);
      return data;
    }
    p+=46+nameLen+extraLen+commentLen;
  }
  throw new Error('SQLITE_ENTRY_NOT_FOUND');
}

if(fs.existsSync(output)){
  const existing=fs.readFileSync(output);
  const existingSha=sha256(existing);
  if(existingSha===expectedDbSha){
    fs.chmodSync(output,0o444);
    console.log(JSON.stringify({ok:true,reused:true,output,bytes:existing.length,sha256:existingSha,mode:'0444'}));
    process.exit(0);
  }
  fs.rmSync(output,{force:true});
}
if(!bundleUrl) throw new Error('AITC_CASE_BUNDLE_URL_REQUIRED');

const response=await fetch(bundleUrl,{redirect:'follow'});
if(!response.ok) throw new Error(`BUNDLE_DOWNLOAD_HTTP_${response.status}`);
const zip=Buffer.from(await response.arrayBuffer());
const actualBundleSha=sha256(zip);
if(bundleSha&&actualBundleSha!==bundleSha) throw new Error(`BUNDLE_SHA256_MISMATCH_${actualBundleSha}`);
const sqlite=extractEntry(zip,entryName);
const actualDbSha=sha256(sqlite);
if(actualDbSha!==expectedDbSha) throw new Error(`SQLITE_SHA256_MISMATCH_${actualDbSha}`);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,sqlite,{mode:0o444});
fs.chmodSync(output,0o444);
const st=fs.statSync(output);
console.log(JSON.stringify({ok:true,reused:false,entry:entryName,output,bytes:st.size,bundleBytes:zip.length,bundleSha256:actualBundleSha,sha256:actualDbSha,mode:(st.mode&0o777).toString(8)}));
