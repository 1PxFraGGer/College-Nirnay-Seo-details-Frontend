const SHEET='1aTyJN0KQRLuGt96aPSGGGV8I8-KVqQmhut07MVEvook';
const $=id=>document.getElementById(id);
let universities=[],snapshot=null,activeUniversity='',activePage='',requestNumber=0,editor=null,dirty=false,busy=false,currentHash='',addAction='';
const text=c=>String(c?.f??c?.v??'');
function readSheet(name){return new Promise((resolve,reject)=>{
  const callback='sheetResponse'+Date.now()+Math.random().toString(36).slice(2),script=document.createElement('script');let timer;
  function clean(){clearTimeout(timer);script.remove();delete window[callback];}
  window[callback]=data=>{clean();if(data.status!=='ok'||!data.table)return reject(Error('The sheet could not be read.'));
    const fields=data.table.cols.map((c,index)=>({column:index+1,label:c.label?.trim()})).filter(f=>f.column>1&&f.label);
    const rows=data.table.rows.map((r,index)=>({row:index+2,page:text(r.c[0]).trim(),values:Object.fromEntries(fields.map(f=>[f.column,text(r.c[f.column-1])]))})).filter(r=>r.page);
    resolve({university:name,fields,rows});
  };
  script.onerror=()=>{clean();reject(Error('Unable to connect to Google Sheets.'));};
  timer=setTimeout(()=>{clean();reject(Error('Google Sheets took too long to respond.'));},20000);
  const q=new URLSearchParams({sheet:name,headers:'1',tqx:'out:json;responseHandler:'+callback,_:Date.now()});
  script.src=`https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?${q}`;document.head.append(script);
});}
async function editorRequest(action,extra={},credentials=editor){
  if(!credentials)throw Error('Connect the editor first.');
  const response=await fetch('/api/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...extra,...credentials,action}),signal:AbortSignal.timeout(70000)});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Unable to confirm the change. Refresh data to check the result.');return result;
}
function status(message,error=false){$('status').textContent=message;$('status').className=error?'error':'';}
function controls(){
  for(const id of ['back','refresh','refresh-universities','connect-editor','submit','university'])$(id).disabled=busy;
  for(const id of ['add-university','add-page','add-field'])$(id).disabled=busy||!editor||(id!=='add-university'&&!snapshot);
  $('save').hidden=!editor||!snapshot?.rows.length;$('save').disabled=busy||!dirty;
  for(const button of $('pages').children)button.disabled=busy;
  for(const input of $('metadata').querySelectorAll('textarea'))input.disabled=busy;
  $('editor-state').textContent=editor?'Editor connected':'Viewer mode';$('connect-editor').textContent=editor?'Disconnect editor':'Connect editor';
}
function discard(){if(busy)return false;if(dirty&&!confirm('Discard your unsaved changes?'))return false;dirty=false;return true;}
function route(name,page){if(!discard())return;const q=new URLSearchParams();if(name)q.set('university',name);if(page)q.set('page',page);location.hash=q.toString();}
function showRow(page){
  activePage=page;dirty=false;const row=snapshot.rows.find(r=>r.page===page);$('page-title').textContent=page;$('metadata').replaceChildren();
  for(const field of snapshot.fields){const div=document.createElement('section');div.className='field';const label=document.createElement(editor?'label':'h3');label.textContent=field.label==='Meta Decription'?'Meta Description':field.label;
    const value=editor?document.createElement('textarea'):document.createElement('p');
    if(editor){value.id='field-'+field.column;label.htmlFor=value.id;value.dataset.column=field.column;value.value=row?.values[field.column]||'';value.rows=field.label.toLowerCase().includes('title')?2:4;value.maxLength=50000;value.oninput=()=>{dirty=snapshot.fields.some(f=>$('field-'+f.column).value!==(row.values[f.column]||''));status(dirty?'Unsaved changes.':'');controls();};}
    else{value.className='value';value.textContent=row?.values[field.column]||'Not added yet';if(!row?.values[field.column])value.classList.add('empty');}
    div.append(label,value);$('metadata').append(div);
  }
  if(!snapshot.fields.length){const p=document.createElement('p');p.textContent='No metadata fields yet. Connect the editor and select Add field.';$('metadata').append(p);}
  for(const b of $('pages').children)b.setAttribute('aria-current',b.textContent===page?'page':'false');controls();
}
function applySnapshot(data,wantedPage){snapshot=data;$('pages').replaceChildren();for(const row of data.rows){const b=document.createElement('button');b.textContent=row.page;b.onclick=()=>route(activeUniversity,row.page);$('pages').append(b);}
  if(data.rows.length)showRow(data.rows.some(r=>r.page===wantedPage)?wantedPage:data.rows[0].page);else{activePage='';$('page-title').textContent='No pages yet';$('metadata').replaceChildren();dirty=false;controls();}
  $('updated').textContent='Last fetched at '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'. '+(editor?'Changes are saved only when you select Save to Google Sheet.':'Connect the editor to change values.');
}
async function load(name,wantedPage){
  const token=++requestNumber;snapshot=null;busy=true;$('metadata').replaceChildren();$('pages').replaceChildren();$('page-title').textContent='Loading pages…';status('Reading the latest entries from Google Sheets…');controls();
  try{const data=editor?await editorRequest('read',{university:name}):await readSheet(name);if(token!==requestNumber)return;applySnapshot(data,wantedPage);status('');}
  catch(error){if(token!==requestNumber)return;$('page-title').textContent='Unable to load entries';status(error.message,true);}
  finally{if(token===requestNumber){busy=false;controls();}}
}
function renderRoute(){
  if(location.hash!==currentHash&&(busy||dirty)){if(!discard()){history.replaceState(null,'',currentHash||location.pathname);return;}}
  currentHash=location.hash;const q=new URLSearchParams(location.hash.slice(1)),name=q.get('university'),page=q.get('page');
  if(!name){requestNumber++;activeUniversity='';snapshot=null;$('selection').hidden=false;$('details').hidden=true;document.title='University Meta Explorer';controls();return;}
  if(!universities.includes(name)){location.hash='';return;}
  $('selection').hidden=true;$('details').hidden=false;$('university-title').textContent=name;document.title=name+' · University Meta Explorer';
  if(name!==activeUniversity||!snapshot){activeUniversity=name;load(name,page);}else if(snapshot.rows.length)showRow(snapshot.rows.some(r=>r.page===page)?page:snapshot.rows[0].page);
}
function fillUniversities(data){universities=data;const selected=$('university').value;$('university').replaceChildren(new Option('Select a university',''));for(const name of data)$('university').add(new Option(name,name));if(data.includes(selected))$('university').value=selected;$('count').textContent=data.length+' universities available · Updated from Google Sheets';}
async function loadUniversities(){
  $('directory-error').textContent='';$('refresh-universities').disabled=true;
  try{let data;if(editor)data=(await editorRequest('list')).universities;else{const r=await fetch('/api/universities',{cache:'no-store',signal:AbortSignal.timeout(25000)});data=await r.json();if(!r.ok)throw Error(data.error||'Unable to read university tabs.');}if(!Array.isArray(data))throw Error('Unable to read university tabs.');fillUniversities(data);renderRoute();}
  catch(error){$('directory-error').textContent=error.message+' Reload the page to try again.';}
  finally{controls();if(!universities.length){$('university').disabled=true;$('submit').disabled=true;}}
}
$('university-form').onsubmit=e=>{e.preventDefault();if($('university').value)route($('university').value);};
$('back').onclick=()=>route();$('refresh').onclick=()=>{if(discard())load(activeUniversity,activePage);};$('refresh-universities').onclick=()=>{if(discard())loadUniversities();};
window.addEventListener('hashchange',renderRoute);window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
$('connect-editor').onclick=async()=>{if(!discard())return;if(editor){editor=null;requestNumber++;busy=false;if(activeUniversity)await load(activeUniversity,activePage);controls();}else{$('connection-status').textContent='';$('connection-dialog').showModal();}};
$('connection-cancel').onclick=()=>{$('connection-dialog').close();$('editor-key').value='';};
$('connection-dialog').addEventListener('close',()=>{$('editor-key').value='';});
$('connection-form').onsubmit=async e=>{e.preventDefault();const credentials={endpoint:$('endpoint').value.trim(),key:$('editor-key').value};$('connection-submit').disabled=true;$('connection-cancel').disabled=true;$('connection-status').textContent='Checking your connection…';
  try{const result=await editorRequest('list',{},credentials);editor=credentials;fillUniversities(result.universities);$('connection-dialog').close();if(activeUniversity)await load(activeUniversity,activePage);controls();}
  catch(error){$('connection-status').textContent=error.message;}
  finally{$('connection-submit').disabled=false;$('connection-cancel').disabled=false;}
};
$('metadata-form').onsubmit=async e=>{e.preventDefault();if(!editor||!dirty||busy)return;const row=snapshot.rows.find(r=>r.page===activePage),values={};for(const f of snapshot.fields){const value=$('field-'+f.column).value;if(value!==row.values[f.column])values[f.column]=value;}
  busy=true;status('Saving to Google Sheets…');controls();
  try{const data=await editorRequest('save',{university:activeUniversity,row:row.row,page:row.page,version:snapshot.version,values});applySnapshot(data,activePage);status('Saved to Google Sheets.');}
  catch(error){status(error.message,true);}
  finally{busy=false;controls();}
};
function openAdd(action){if(!editor||!discard())return;addAction=action;const item=action==='addUniversity'?'university':action==='addPage'?'page':'field';$('add-title').textContent='Add '+item;$('name-label').textContent=item[0].toUpperCase()+item.slice(1)+' name';$('new-name').value='';$('new-name').maxLength=action==='addUniversity'?100:200;$('add-status').textContent='';$('add-help').textContent=action==='addUniversity'?'Creates a university tab with the standard pages and metadata fields.':action==='addPage'?'Adds a page option to this university. You can enter its metadata next.':'Adds a metadata column for every page in this university.';$('add-dialog').showModal();}
$('add-university').onclick=()=>openAdd('addUniversity');$('add-page').onclick=()=>openAdd('addPage');$('add-field').onclick=()=>openAdd('addField');$('add-cancel').onclick=()=>$('add-dialog').close();
$('add-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
$('connection-dialog').addEventListener('cancel',e=>{if($('connection-submit').disabled)e.preventDefault();});
$('add-form').onsubmit=async e=>{e.preventDefault();const name=$('new-name').value.trim();$('add-submit').disabled=true;$('add-cancel').disabled=true;busy=true;controls();$('add-status').textContent='Adding to Google Sheets…';
  try{const data=await editorRequest(addAction,{name,university:activeUniversity,version:snapshot?.version});
    if(addAction==='addUniversity'){fillUniversities((await editorRequest('list')).universities);activeUniversity=data.university;applySnapshot(data);const q=new URLSearchParams({university:activeUniversity});history.replaceState(null,'','#'+q);currentHash=location.hash;$('selection').hidden=true;$('details').hidden=false;$('university-title').textContent=activeUniversity;document.title=activeUniversity+' · University Meta Explorer';}
    else{applySnapshot(data,addAction==='addPage'?name:activePage);const q=new URLSearchParams({university:activeUniversity,page:activePage});history.replaceState(null,'','#'+q);currentHash=location.hash;}
    $('add-dialog').close();status('Added to Google Sheets. You can now enter the details.');
  }catch(error){$('add-status').textContent=error.message;}
  finally{busy=false;controls();$('add-submit').disabled=false;$('add-cancel').disabled=false;}
};
controls();loadUniversities();
