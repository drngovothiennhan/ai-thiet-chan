import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
function mustReplace(source,oldText,newText,label){
  if(source.includes(newText))return source;
  if(!source.includes(oldText))throw new Error(`patch target missing: ${label}`);
  return source.replace(oldText,newText);
}

for(const dir of ['public','tests']){
  for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    if(!entry.isFile()||!/(?:\.m?js|\.html|\.css|\.json|\.webmanifest)$/i.test(entry.name))continue;
    const file=path.join(dir,entry.name);const before=read(file);const after=before.replaceAll('2.8.2','2.9.0');if(after!==before)write(file,after);
  }
}

let server=read('server.mjs');
server=mustReplace(server,
  "import { KNOWLEDGE_VERSION, KNOWLEDGE_SOURCES, TONGUE_KNOWLEDGE } from './knowledge.mjs';",
  "import { KNOWLEDGE_VERSION, KNOWLEDGE_SOURCES, TONGUE_KNOWLEDGE, knowledgeForQuery } from './knowledge.mjs';",
  'server knowledge import');
server=mustReplace(server,"const VERSION = '2.5.0';","const VERSION = '2.9.0';",'server version');
server=mustReplace(server,
  'const assessment={mode:selectedMode,top,bottom,combined,knowledgeVersion:KNOWLEDGE_VERSION,knowledgeSources:KNOWLEDGE_SOURCES};',
  'const assessment={mode:selectedMode,top,bottom,combined,knowledgeVersion:KNOWLEDGE_VERSION};',
  'source list removal from assessment');
server=mustReplace(server,
  "Bạn là bộ phân tích thiệt tượng YHCT của A.I Thiệt Chẩn. Chỉ dùng HỆ TRI THỨC được cung cấp và những gì nhìn thấy trực tiếp trong ảnh. Không tự bịa triệu chứng, mạch chẩn, bệnh danh, nguyên nhân, điều trị hay phương thuốc. Công cụ chỉ hỗ trợ học tập/tham khảo, không phải chẩn đoán xác định.",
  "Bạn là bộ phân tích thiệt tượng YHCT của A.I Thiệt Chẩn. Chỉ dùng HỆ TRI THỨC được cung cấp và những gì nhìn thấy trực tiếp trong ảnh. Không tự bịa triệu chứng, mạch chẩn, bệnh danh, nguyên nhân, điều trị hay phương thuốc. Công cụ chỉ hỗ trợ học tập/tham khảo, không phải chẩn đoán xác định. Trong JSON phân tích tuyệt đối không xuất tên tài liệu, mã nguồn, số trang, mục Nguồn đối chiếu hoặc mục Tham khảo.",
  'analysis reference boundary');
server=mustReplace(server,
  "const context=assessment||analysis;const contextText=context?JSON.stringify(context):'Chưa có kết quả phân tích hình lưỡi.';",
  "const context=assessment||analysis;const contextText=context?JSON.stringify(context):'Chưa có kết quả phân tích hình lưỡi.';\n    const hasAssessment=Boolean(context);\n    const retrievedKnowledge=hasAssessment?knowledgeForQuery(`${contextText}\\n${message}`,{limit:18}):TONGUE_KNOWLEDGE;",
  'chat retrieval bootstrap');
const chatStart=server.indexOf("app.post('/api/chat'");
const reportStart=server.indexOf("app.post('/api/report'",chatStart);
if(chatStart<0||reportStart<0)throw new Error('chat/report block not found');
let beforeChat=server.slice(0,chatStart),chat=server.slice(chatStart,reportStart),afterChat=server.slice(reportStart);
chat=mustReplace(chat,'${TONGUE_KNOWLEDGE}','${retrievedKnowledge}','chat retrieved knowledge');
chat=mustReplace(chat,
  'Trả lời ngắn gọn bằng tiếng Việt theo hướng học tập/tham khảo.`;',
  'Trả lời ngắn gọn bằng tiếng Việt theo hướng học tập/tham khảo. Nếu đã có kết quả thiệt chẩn, cuối câu trả lời thêm mục “Nguồn đối chiếu” và chỉ liệt kê đúng các tài liệu/trang thực sự đã dùng trong lập luận. Nếu chưa có kết quả thiệt chẩn, không hiển thị mục nguồn.`;',
  'chat source display boundary');
server=beforeChat+chat+afterChat;
server=mustReplace(server,
  'Không biến tín hiệu thiệt tượng thành chẩn đoán xác định.\\nMode:',
  'Không biến tín hiệu thiệt tượng thành chẩn đoán xác định. Không hiển thị tên tài liệu, nguồn tham khảo, mã citation hoặc số trang.\\nMode:',
  'report reference boundary');
write('server.mjs',server);

let home=read('public/index.html');
home=mustReplace(home,'  <link rel="stylesheet" href="/quality-dashboard.css" />','  <link rel="stylesheet" href="/quality-dashboard.css" />\n  <link rel="stylesheet" href="/release-ui.css" />','release UI stylesheet');
home=mustReplace(home,'  <script src="/quality-dashboard.js" defer></script>','  <script src="/quality-dashboard.js" defer></script>\n  <script src="/release-ui.js" defer></script>','release UI script');
write('public/index.html',home);

let sw=read('public/sw.js');
if(!sw.includes("'/release-ui.css'"))sw=mustReplace(sw,"'/quality-dashboard.css'","'/quality-dashboard.css','/release-ui.css'",'SW release CSS');
if(!sw.includes("'/release-ui.js'"))sw=mustReplace(sw,"'/upload-controls.js'","'/upload-controls.js','/release-ui.js'",'SW release JS');
write('public/sw.js',sw);

const pkgPath=path.join(root,'package.json');const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
pkg.version='2.9.0';
for(const key of ['test','check'])pkg.scripts[key]=String(pkg.scripts[key]||'').replaceAll('2.8.2','2.9.0');
if(!pkg.scripts.check.includes('node --check knowledge-extended.mjs'))pkg.scripts.check=pkg.scripts.check.replace('node --check knowledge-evidence.mjs','node --check knowledge-evidence.mjs && node --check knowledge-extended.mjs');
if(!pkg.scripts.check.includes('node --check public/release-ui.js'))pkg.scripts.check=pkg.scripts.check.replace('node --check public/upload-controls.js','node --check public/upload-controls.js && node --check public/release-ui.js');
for(const key of ['test','check'])if(!pkg.scripts[key].includes('tests/release-2.9-smoke.mjs'))pkg.scripts[key]+=' && node tests/release-2.9-smoke.mjs';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');

console.log('release 2.9.0 patch applied');
