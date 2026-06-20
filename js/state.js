// ---------- State ----------
let S = load();
function load(){ try{ const d=JSON.parse(localStorage.getItem('ascend')); return d? Object.assign(fresh(),d) : fresh(); }catch(e){ return fresh(); } }
// Starter split everyone begins with — a classic Push / Pull / Legs to guide new lifters.
function defaultRoutines(){ return [
  {rid:1, name:'Push Day', items:[{id:'bench',sets:4},{id:'ohp',sets:3},{id:'inclineDb',sets:3},{id:'pushdown',sets:3}]},
  {rid:2, name:'Pull Day', items:[{id:'dead',sets:3},{id:'rowBb',sets:4},{id:'latpull',sets:3},{id:'curlBb',sets:3}]},
  {rid:3, name:'Leg Day',  items:[{id:'squat',sets:4},{id:'rdl',sets:3},{id:'legpress',sets:3},{id:'legcurl',sets:3},{id:'calf',sets:3}]},
]; }
function fresh(){ return { name:'Athlete', bw:180, units:'lb', heightCm:null, heightUnit:'cm', age:null, activity:'moderate', bodyFat:null, goal:null, calories:null,
  sessions:[], active:null, routines:defaultRoutines(), comp:{tier:0, div:0, sr:0, wins:0, losses:0, streak:0}, posts:[], meals:[], pro:false,
  shards:120, owned:['th_mid','bd_none','bn_none'], inv:{}, boost:null, theme:'th_mid', border:'bd_none', banner:'bn_none', deals:null, onboarded:false }; }
  // NOTE: streak state (S.stk / S.stkLost) is intentionally NOT in fresh() — undefined triggers deriveStreak() migration from session history.
function save(){
  if(window.cloud && cloud.ready()){ S.profileUpdatedAt=Date.now(); try{ S.sr=overallSR(); }catch(e){} }
  localStorage.setItem('ascend', JSON.stringify(S));
  if(window.cloud && cloud.ready()) cloud.mark('profile');
}

// ---------- Custom exercises (user-submitted, pending official review) ----------
function groupDefaultStd(g){ const arr=EXERCISES.filter(e=>e.group===g&&!e.custom).map(e=>e.std).sort((a,b)=>a-b); return arr.length?arr[Math.floor(arr.length/2)]:1; }
function registerCustomEx(c){ if(EXMAP[c.id]) return; const e={...c, custom:true, icon:c.icon||'🧩', w:0.6}; EXERCISES.push(e); EXMAP[e.id]=e; }
(S.customEx||[]).forEach(registerCustomEx);
function openAddEx(){
  document.getElementById('cxGroup').innerHTML=GROUPS.map(g=>`<option>${g}</option>`).join('');
  document.getElementById('cxName').value=''; document.getElementById('cxEquip').value='';
  openModal('addExModal');
}
function submitCustomEx(){
  const name=(document.getElementById('cxName').value||'').trim();
  const group=document.getElementById('cxGroup').value, equip=(document.getElementById('cxEquip').value||'').trim();
  if(!name){ toast('Give the exercise a name'); return; }
  if(EXERCISES.some(e=>e.name.toLowerCase()===name.toLowerCase())){ toast('That exercise already exists'); return; }
  const c={id:'cx'+Date.now(), name, group, std:groupDefaultStd(group), equip};
  S.customEx=S.customEx||[]; S.customEx.push(c); registerCustomEx(c); save();
  if(window.cloud && cloud.ready()) cloud.mark('customEx');
  // queue for official review — appends to exercise-requests.md when running on the ASCEND dev server
  fetch('/api/exercise-request',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name, group, equipment:equip, by:S.name||'Athlete', when:new Date().toISOString()})}).catch(()=>{});
  closeModal('addExModal'); if(document.getElementById('exModal').classList.contains('show')) renderExOptions();
  haptic([0,25]); toast('✓ '+name+' added — sent for review 🧩');
}

