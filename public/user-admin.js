(()=>{
  const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
  const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
  const ADMIN_TOKEN_KEY='aitcClinicalAdminToken';
  const DRIVE_USER_URL='https://drive.google.com/drive/folders/1okZqMuLd73sfQVLZxL5XN-t7r1aptXHY';
  const XLSX_SRC='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const adminToken=()=>sessionStorage.getItem(ADMIN_TOKEN_KEY)||'';
  let xlsxPromise=null;

  async function rpc(name,payload){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.message||data?.hint||data?.error||`HTTP ${response.status}`);
    return data;
  }
  function status(text,kind=''){
    const el=$('studentAdminStatus');if(!el)return;el.hidden=!text;el.textContent=text||'';el.className=`admin-center-status ${kind}`.trim();
  }
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=XLSX_SRC;script.async=true;script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Không tải được bộ đọc Excel.'));script.onerror=()=>reject(new Error('Không tải được bộ đọc Excel.'));document.head.appendChild(script);
    });
    return xlsxPromise;
  }
  function normalizeHeader(value){
    return String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
  }
  const HEADER_ALIASES={
    stt:['stt','so stt','so thu tu'],
    fullName:['ho ten','ho va ten'],
    birthYear:['nam sinh'],
    mssv:['mssv','ma so sinh vien','ma sinh vien'],
    faculty:['khoa'],
    className:['lop']
  };
  function findColumns(headerRow){
    const normalized=headerRow.map(normalizeHeader),columns={};
    for(const [key,aliases] of Object.entries(HEADER_ALIASES)){
      const index=normalized.findIndex(v=>aliases.includes(v));
      if(index<0)throw new Error(`Thiếu cột bắt buộc: ${key==='fullName'?'Họ tên':key==='birthYear'?'Năm sinh':key==='className'?'Lớp':key==='mssv'?'MSSV':key==='faculty'?'Khoa':'STT'}.`);
      columns[key]=index;
    }
    return columns;
  }
  async function parseExcel(file){
    const XLSX=await loadXlsx();
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
    const sheet=workbook.Sheets[workbook.SheetNames[0]];if(!sheet)throw new Error('File Excel không có sheet dữ liệu.');
    const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
    const headerIndex=matrix.findIndex(row=>Array.isArray(row)&&row.some(v=>normalizeHeader(v)==='mssv'));
    if(headerIndex<0)throw new Error('Không tìm thấy dòng tiêu đề có cột MSSV.');
    const columns=findColumns(matrix[headerIndex]||[]),map=new Map();let validInput=0,duplicates=0;
    for(const row of matrix.slice(headerIndex+1)){
      if(!Array.isArray(row)||!row.some(v=>String(v??'').trim()))continue;
      const mssv=String(row[columns.mssv]??'').trim().toUpperCase();
      const item={
        stt:String(row[columns.stt]??'').trim(),fullName:String(row[columns.fullName]??'').trim(),birthYear:String(row[columns.birthYear]??'').trim(),mssv,
        faculty:String(row[columns.faculty]??'').trim(),className:String(row[columns.className]??'').trim()
      };
      if(!item.mssv||!item.fullName||!item.birthYear||!item.faculty||!item.className)continue;
      validInput+=1;if(map.has(item.mssv))duplicates+=1;map.set(item.mssv,item);
    }
    if(!map.size)throw new Error('Không có dòng sinh viên hợp lệ để nạp.');
    return {rows:[...map.values()],validInput,duplicates};
  }

  function ensureUi(){
    const dashboard=$('adminDashboard');if(!dashboard||$('studentAdminBlock'))return;
    const section=document.createElement('section');section.id='studentAdminBlock';section.className='admin-block';
    section.innerHTML=`
      <div class="admin-block-head"><div><h3>Quản lý sinh viên</h3><p>Có thể tạo nhanh user chỉ bằng MSSV hoặc nạp danh sách Excel. MSSV là tên đăng nhập và mật khẩu lần đầu; người dùng bắt buộc đổi mật khẩu sau khi đăng nhập.</p></div><button id="studentRefreshBtn" class="btn ghost compact" type="button">Làm mới</button></div>
      <div class="student-create-toolbar">
        <input id="studentCreateMssv" class="student-search" inputmode="text" autocomplete="off" maxlength="40" placeholder="Nhập MSSV để tạo user" aria-label="MSSV cần tạo" />
        <button id="studentCreateBtn" class="btn primary compact" type="button">Tạo user bằng MSSV</button>
      </div>
      <p class="settings-note">Tạo nhanh: mật khẩu tạm thời = MSSV, tài khoản hoạt động ngay và bắt buộc đổi mật khẩu. Họ tên/Khoa/Lớp chưa có sẽ hiển thị “Chưa cập nhật” cho tới khi admin nạp Excel.</p>
      <div class="student-admin-toolbar">
        <label class="btn primary compact">Nạp file Excel<input id="studentExcelFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden /></label>
        <a class="btn ghost compact" href="${DRIVE_USER_URL}" target="_blank" rel="noopener">Drive A.I Thiệt Chẩn/user</a>
        <input id="studentSearchInput" class="student-search" placeholder="Tìm MSSV, họ tên hoặc lớp" />
        <button id="studentSearchBtn" class="btn ghost compact" type="button">Tìm</button>
      </div>
      <p class="settings-note">File nguồn được quản lý tại thư mục Drive /user; danh sách sau duyệt được đồng bộ vào kho tài khoản của hệ thống.</p>
      <div id="studentAdminStats" class="admin-meta">Chưa tải danh sách.</div>
      <div id="studentAdminStatus" class="admin-center-status" hidden></div>
      <div id="studentAdminList" class="admin-list"></div>`;
    dashboard.appendChild(section);
    $('studentExcelFile')?.addEventListener('change',importExcel);
    $('studentCreateBtn')?.addEventListener('click',createStudentFromMssv);
    $('studentCreateMssv')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();createStudentFromMssv();}});
    $('studentRefreshBtn')?.addEventListener('click',()=>loadStudents());
    $('studentSearchBtn')?.addEventListener('click',()=>loadStudents($('studentSearchInput')?.value||''));
    $('studentSearchInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();loadStudents(event.currentTarget.value);}});
    $('studentAdminList')?.addEventListener('click',handleListAction);
    $('adminRefreshBtn')?.addEventListener('click',()=>setTimeout(()=>loadStudents(),0));
    const style=document.createElement('style');style.textContent=`.student-create-toolbar,.student-admin-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.student-create-toolbar{margin-bottom:4px}.student-search{flex:1;min-width:180px;border:1px solid #cfdad8;border-radius:10px;padding:9px 11px}.student-row .admin-meta{display:flex;flex-wrap:wrap;gap:6px}.student-row .admin-actions{flex-wrap:wrap}`;document.head.appendChild(style);
  }

  async function createStudentFromMssv(){
    const input=$('studentCreateMssv'),button=$('studentCreateBtn');
    const mssv=String(input?.value||'').trim().toUpperCase();
    if(!mssv){status('Nhập MSSV cần tạo.','warn');input?.focus();return;}
    if(mssv.length<3||mssv.length>40||!/^[A-Z0-9._-]+$/.test(mssv)){status('MSSV chỉ dùng chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang (3–40 ký tự).','warn');input?.focus();return;}
    if(!adminToken()){status('Phiên Admin Center chưa đăng nhập.','warn');return;}
    if(button)button.disabled=true;
    status(`Đang tạo user ${mssv}…`);
    try{
      const result=await rpc('ai_thiet_chan_admin_create_student_v1',{p_admin_token:adminToken(),p_mssv:mssv});
      status(`Đã tạo user ${result?.mssv||mssv}. Mật khẩu tạm thời = MSSV; người dùng phải đổi mật khẩu sau lần đăng nhập đầu.`,'good');
      if(input)input.value='';
      await loadStudents();
    }catch(err){
      const message=/student_exists/i.test(String(err?.message||''))?'MSSV này đã có tài khoản.':/invalid_mssv/i.test(String(err?.message||''))?'MSSV không hợp lệ.':err.message;
      status(`Không tạo được user ${mssv}: ${message}`,'warn');
    }finally{if(button)button.disabled=false;}
  }

  async function importExcel(event){
    const file=event.target.files?.[0];if(!file)return;
    status('Đang đọc và kiểm tra file Excel…');
    try{
      if(!adminToken())throw new Error('Phiên Admin Center chưa đăng nhập.');
      const parsed=await parseExcel(file);
      status(`Đã đọc ${parsed.validInput} dòng hợp lệ; đang nạp ${parsed.rows.length} MSSV duy nhất…`);
      const result=await rpc('ai_thiet_chan_admin_import_students_v1',{p_admin_token:adminToken(),p_rows:parsed.rows,p_source_file_name:file.name});
      const removed=Number(result?.duplicatesRemoved||0)+parsed.duplicates;
      status(`Nạp thành công ${result?.unique??parsed.rows.length} sinh viên. Đã loại ${removed} dòng trùng MSSV. Tổng tài khoản đang hoạt động: ${result?.totalActive??'—'}.`,'good');
      await loadStudents();
    }catch(err){status(`Nạp Excel thất bại: ${err.message}`,'warn');}
    finally{event.target.value='';}
  }

  async function loadStudents(search=''){
    ensureUi();const list=$('studentAdminList');if(!list||!adminToken())return;
    list.innerHTML='<div class="admin-empty">Đang tải danh sách sinh viên…</div>';
    try{
      const data=await rpc('ai_thiet_chan_admin_list_students_v1',{p_admin_token:adminToken(),p_limit:500,p_offset:0,p_search:String(search||'').trim()});
      const students=Array.isArray(data?.students)?data.students:[];
      $('studentAdminStats').textContent=`Tổng ${data?.total??students.length} · đang hoạt động ${data?.active??students.filter(x=>x.active).length}${search?` · kết quả tìm ${students.length}`:''}`;
      if(!students.length){list.innerHTML='<div class="admin-empty">Không có sinh viên phù hợp.</div>';return;}
      list.innerHTML=students.map(s=>`<article class="admin-item student-row" data-mssv="${esc(s.mssv)}"><div class="admin-meta"><strong>${esc(s.mssv)}</strong><span>${s.active?'Đang hoạt động':'Đã khóa'}</span><span>${s.mustChangePassword?'MK lần đầu':'Đã đổi MK'}</span></div><strong>${esc(s.fullName)}</strong><p>${esc(s.birthYear||'')} · ${esc(s.faculty||'')} · ${esc(s.className||'')}</p><div class="admin-actions"><button class="btn ghost compact" data-action="toggle" data-active="${s.active?'0':'1'}" type="button">${s.active?'Khóa':'Mở khóa'}</button><button class="btn ghost compact" data-action="reset" type="button">Reset MK = MSSV</button><button class="btn danger compact" data-action="delete" type="button">Xóa</button></div></article>`).join('');
    }catch(err){list.innerHTML=`<div class="admin-empty warn">Không tải được danh sách: ${esc(err.message)}</div>`;}
  }

  async function handleListAction(event){
    const button=event.target.closest('button[data-action]');if(!button)return;
    const row=button.closest('[data-mssv]'),mssv=row?.dataset.mssv,action=button.dataset.action;if(!mssv)return;
    button.disabled=true;
    try{
      if(action==='toggle'){
        await rpc('ai_thiet_chan_admin_set_student_active_v1',{p_admin_token:adminToken(),p_mssv:mssv,p_active:button.dataset.active==='1'});
        status(`Đã cập nhật trạng thái ${mssv}.`,'good');
      }else if(action==='reset'){
        if(!confirm(`Reset mật khẩu của ${mssv} về chính MSSV?`))return;
        await rpc('ai_thiet_chan_admin_reset_student_password_v1',{p_admin_token:adminToken(),p_mssv:mssv});
        status(`Đã reset mật khẩu ${mssv} về MSSV.`,'good');
      }else if(action==='delete'){
        if(!confirm(`Xóa tài khoản sinh viên ${mssv}?`))return;
        await rpc('ai_thiet_chan_admin_delete_student_v1',{p_admin_token:adminToken(),p_mssv:mssv});
        status(`Đã xóa ${mssv}.`,'good');
      }
      await loadStudents($('studentSearchInput')?.value||'');
    }catch(err){status(`Không cập nhật được ${mssv}: ${err.message}`,'warn');}
    finally{button.disabled=false;}
  }

  function observe(){
    ensureUi();
    const dashboard=$('adminDashboard');
    if(dashboard&&!dashboard.hidden&&adminToken()&&dashboard.dataset.studentUsersLoaded!=='1'){
      dashboard.dataset.studentUsersLoaded='1';loadStudents();
    }
  }
  new MutationObserver(observe).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  observe();
})();
