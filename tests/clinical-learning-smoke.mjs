// Repo-native regression gate for A.I Thiet Chan clinical learning v2.8.2.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const consultation=fs.readFileSync(new URL('../public/consultation.js',import.meta.url),'utf8');
const learning=fs.readFileSync(new URL('../public/clinical-learning.js',import.meta.url),'utf8');
const lifecycle=fs.readFileSync(new URL('../public/feedback-lifecycle.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../public/open-source.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');

assert.ok(consultation.includes("window.__aitcRawFetch=window.__aitcRawFetch||window.fetch.bind(window);"),'missing raw fetch bootstrap');
assert.ok(consultation.includes("import('/clinical-learning.js?v=2.8.2')"),'missing versioned clinical learning bootstrap');

for(const marker of [
  'HIU CLB YHCT',
  'ai_thiet_chan_submit_feedback_v1',
  'ai_thiet_chan_admin_list_feedback_v1',
  'ai_thiet_chan_admin_review_feedback_v1',
  'ai_thiet_chan_find_learned_cases_v1',
  'Góp ý ca lâm sàng',
  'Phân tích ca trước',
  'clinical-feedback-card{display:block}',
  'Bác sĩ',
  'Y sĩ',
  'admin duyệt'
]) assert.ok(learning.includes(marker),`missing clinical learning marker: ${marker}`);
for(const marker of ['hideSubmittedFeedback','reopenForNewCase','Đã gửi về admin',"url.includes('/api/analyze')",'feedbackSubmitted']) assert.ok(lifecycle.includes(marker),`missing feedback lifecycle marker: ${marker}`);

assert.ok(source.includes('Sản phẩm được phát triển bởi Câu Lạc Bộ Y Học Cổ Truyền Trường Đại Học Quốc Tế Hồng Bàng, phục vụ việc học và tham vấn chuyên môn'),'missing attribution');
assert.ok(sw.includes("ai-thiet-chan-v2.8.2"),'service worker cache not bumped');
assert.ok(sw.includes("'/clinical-learning.js'")&&sw.includes("'/feedback-lifecycle.js'"),'clinical learning lifecycle missing from app shell');
console.log('clinical-learning-smoke: ok');
