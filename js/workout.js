// ---------- Memories (workout calendar on Profile) ----------
function sessionsByDay(){ const map={}; S.sessions.forEach(s=>{ const k=new Date(s.start).toDateString(); (map[k]=map[k]||[]).push(s); }); return map; }
function dayActivation(sess){ const act={}; GROUPS.forEach(g=>act[g]=0); sess.forEach(s=>{ const a=activationForSession(s); GROUPS.forEach(g=>act[g]+=a[g]); }); return act; }
function memCell(d, map, today){
  const dk=d.toDateString(), isToday=d.getTime()===today.getTime(), isFuture=d.getTime()>today.getTime();
  const sess=map[dk];
  if(sess){
    const cf=actColorFn(dayActivation(sess));
    return `<div class="memcell has ${isToday?'today':''}" onclick="openMemory('${dk}')">
      <div class="membodies"><div class="memhalf">${bodySVG('front',cf,60)}</div><div class="memhalf">${bodySVG('back',cf,60)}</div></div>
      <div class="memnum over">${d.getDate()}</div></div>`;
  }
  return `<div class="memcell ${isToday?'today':''}"><div class="memnum ${isFuture?'dim':''}">${d.getDate()}</div></div>`;
}
function memGridHTML(weeks){
  const map=sessionsByDay(); const today=new Date(); today.setHours(0,0,0,0);
  const start=new Date(today); start.setDate(start.getDate()-today.getDay()-(weeks-1)*7);
  let cells=''; for(let i=0;i<weeks*7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); cells+=memCell(d,map,today); }
  const hdr=['Su','Mo','Tu','We','Th','Fr','Sa'].map(x=>`<div>${x}</div>`).join('');
  return `<div class="memhdr">${hdr}</div><div class="memgrid">${cells}</div>`;
}
function renderMemories(){ const el=document.getElementById('memCal'); if(el) el.innerHTML=memGridHTML(2); }
function openAllMemories(){
  let weeks=4;
  if(S.sessions.length){ const today=new Date(); today.setHours(0,0,0,0); const earliest=Math.min(...S.sessions.map(s=>s.start));
    weeks=Math.max(4, Math.min(16, Math.ceil((today-new Date(new Date(earliest).toDateString()))/(7*864e5))+2)); }
  document.getElementById('allMemSheet').innerHTML=`<div class="grab"></div>
    <h2 style="margin:0 0 12px;">${icon('calendar',19)} All memories</h2>${memGridHTML(weeks)}
    <button class="btn ghost" onclick="closeModal('allMemModal')" style="margin-top:14px;">Close</button>`;
  openModal('allMemModal');
}
function fmtDur(ms){ if(!ms) return '—'; const m=Math.round(ms/60000); return m>=60 ? (Math.floor(m/60)+'h '+(m%60)+'m') : m+'m'; }
function openMemory(dk){
  const sess=sessionsByDay()[dk]; if(!sess) return;
  const cf=actColorFn(dayActivation(sess));
  let dur=0; sess.forEach(s=>{ if(s.end) dur+=s.end-s.start; });
  const totalSets=sess.reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+e.sets.length,0),0);
  const totalVol=sess.reduce((a,s)=>a+sessionVolume(s),0);
  let exHtml=''; sess.forEach(s=>s.exercises.forEach(ex=>{ const meta=EXMAP[ex.id];
    const setsTxt=ex.sets.map(st=>`${st.weight}×${st.reps}`).join('  ');
    exHtml+=`<div class="lift"><div class="liftmark">${meta.icon}</div><div class="grow"><div style="font-weight:700;">${meta.name}</div><div class="tiny muted">${ex.sets.length} sets · ${setsTxt}</div></div></div>`;
  }));
  const d=new Date(dk);
  document.getElementById('memorySheet').innerHTML=`<div class="grab"></div>
    <h2 style="margin:0;">${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</h2>
    <div class="statgrid" style="margin:12px 0;">
      <div class="stat"><div class="v">${fmtDur(dur)}</div><div class="l">Duration</div></div>
      <div class="stat"><div class="v">${totalSets}</div><div class="l">Total Sets</div></div>
    </div>
    <div style="display:flex;justify-content:center;gap:10px;">${bodySVG('front',cf,120)}${bodySVG('back',cf,120)}</div>
    <div class="tiny muted" style="text-align:center;margin:4px 0 14px;">Muscles trained · brighter = more volume · ${fmt(totalVol)} ${S.units} volume</div>
    <h2 style="margin:6px 0 8px;font-size:17px;">Logged workout</h2>
    <div class="card" style="margin-bottom:6px;">${exHtml}</div>
    <button class="btn ghost" onclick="closeModal('memoryModal')">Close</button>`;
  openModal('memoryModal');
}
function sessionVolume(ses){ let v=0; for(const ex of ses.exercises) for(const s of ex.sets) v+=(+s.weight||0)*(+s.reps||0); return v; }

// set editing
function addSet(ei){ const prev=S.active.exercises[ei].sets.slice(-1)[0]||{}; S.active.exercises[ei].sets.push({weight:prev.weight||'',reps:'',done:false}); save(); renderTrain(); }
function rmSet(ei,si){ S.active.exercises[ei].sets.splice(si,1); if(!S.active.exercises[ei].sets.length) S.active.exercises[ei].sets.push({weight:'',reps:'',done:false}); save(); renderTrain(); }
function setVal(ei,si,k,v){ S.active.exercises[ei].sets[si][k]=v; save(); }
function rmExercise(ei){ S.active.exercises.splice(ei,1); save(); renderTrain(); }
function toggleDone(ei,si){ const s=S.active.exercises[ei].sets[si]; s.done=!s.done; if(s.done) startRest(); save(); renderTrain(); }
function cancelWorkout(){ confirmDialog({ title:'Discard this workout?', message:'The sets you’ve logged this session will be lost.', confirmText:'Discard', onConfirm:()=>{ S.active=null; rest=0; hideFocus(); save(); renderTrain(); toast('Workout discarded'); } }); }

// Swipe a set row left to delete it. Delegated on #activeWorkout (survives re-renders); rows
// carry data-ei/data-si. Horizontal-only — a vertical drag scrolls, a tap still edits the inputs.
(function(){
  const KILL=78; let sw=null, x0=0, y0=0, dx=0, decided=false;
  const fg=()=>sw&&sw.querySelector('.setrow'), del=()=>sw&&sw.querySelector('.swipe-del');
  function reset(){ const f=fg(),d=del(); if(f){f.style.transition='';f.style.transform='';f.style.opacity='';} if(d)d.style.opacity='0'; sw=null; dx=0; decided=false; }
  function start(e){ const t=e.target.closest('.swipe'); if(!t){sw=null;return;} sw=t; const p=e.touches[0]; x0=p.clientX; y0=p.clientY; dx=0; decided=false; const f=fg(); if(f) f.style.transition=''; }
  function move(e){ if(!sw) return; const p=e.touches[0]; dx=p.clientX-x0; const dy=p.clientY-y0;
    if(!decided){ if(Math.abs(dx)<7 && Math.abs(dy)<7) return; if(Math.abs(dy)>=Math.abs(dx)){ sw=null; return; } decided=true; }
    if(dx>0) dx=0; const f=fg(),d=del(); if(f) f.style.transform='translateX('+dx+'px)'; if(d) d.style.opacity=Math.min(1,-dx/KILL); e.preventDefault(); }
  function end(){ if(!sw||!decided){ if(sw&&!decided) reset(); return; } const f=fg();
    if(dx<=-KILL){ const ei=+sw.dataset.ei, si=+sw.dataset.si;
      if(f){ f.style.transition='transform .14s ease, opacity .14s'; f.style.transform='translateX(-110%)'; f.style.opacity='0'; }
      haptic([0,28]); const t=sw; sw=null; setTimeout(()=>rmSet(ei,si),120);
    } else { if(f) f.style.transition='transform .18s ease'; const d=del(); reset(); if(f){ f.style.transform=''; } }
  }
  const c=document.getElementById('activeWorkout');
  if(c){ c.addEventListener('touchstart',start,{passive:true}); c.addEventListener('touchmove',move,{passive:false}); c.addEventListener('touchend',end); c.addEventListener('touchcancel',reset); }
})();
// ----- Finish workout review (bodyweight capture + optional share) -----
let finMedia=null, finShare=false, finCapText='', finWorkoutOpen=false;
function finishWorkout(){
  const hasSets = S.active && S.active.exercises.some(ex=>ex.sets.some(s=>s.weight&&s.reps));
  if(!hasSets){ toast('Log a completed set first'); return; }
  finMedia=null; finShare=false; finCapText=''; finWorkoutOpen=false; renderFinishReview(); openModal('finishModal');
}
function toggleFinShare(){ const c=document.getElementById('finCap'); if(c) finCapText=c.value; finShare=!finShare; renderFinishReview(); }
// Reveal the logged exercises/sets as a dropdown that overlays the finish sheet.
// Toggle the class directly (no re-render) so nearby inputs keep their focus/value.
function toggleFinWorkout(){ finWorkoutOpen=!finWorkoutOpen; const d=document.getElementById('finWorkoutDrop'); if(d) d.classList.toggle('open', finWorkoutOpen); }
function pickFinMedia(input){ readImage(input,u=>{ finMedia=u; renderFinishReview(); }); }
function renderFinishReview(){
  const a=S.active; if(!a) return;
  const exs=a.exercises.map(e=>({...e,sets:e.sets.filter(s=>s.weight&&s.reps)})).filter(e=>e.sets.length);
  const sets=exs.reduce((x,e)=>x+e.sets.length,0);
  const vol=exs.reduce((x,e)=>x+e.sets.reduce((y,s)=>y+(+s.weight)*(+s.reps),0),0);
  const cf=actColorFn(activationForSession({exercises:exs}));
  document.getElementById('finishSheet').innerHTML=`<div class="grab"></div>
    <h2 style="margin:0;">Finish workout</h2>
    <div class="statgrid" style="margin:12px 0;">
      <div class="stat"><div class="v">${fmtClock(Date.now()-a.start)}</div><div class="l">Duration</div></div>
      <div class="stat"><div class="v">${sets}</div><div class="l">Sets</div></div>
    </div>
    <div style="display:flex;justify-content:center;gap:10px;">${bodySVG('front',cf,108)}${bodySVG('back',cf,108)}</div>
    <div class="tiny muted" style="text-align:center;margin:4px 0 14px;">${fmt(vol)} ${S.units} volume · brighter = more</div>
    <div class="findrop${finWorkoutOpen?' open':''}" id="finWorkoutDrop">
      <button type="button" class="findrop-head" onclick="toggleFinWorkout()">
        <div class="row" style="gap:11px;min-width:0;">
          <div class="liftmark">${(exs[0]&&EXMAP[exs[0].id]||{}).icon||'🏋️'}</div>
          <div style="min-width:0;"><div style="font-weight:700;">Your workout</div><div class="tiny muted">${exs.length} exercise${exs.length===1?'':'s'} · ${sets} set${sets===1?'':'s'}</div></div>
        </div>
        <span class="findrop-chev">⌄</span>
      </button>
      <div class="findrop-panel"><div class="findrop-inner">
        ${exs.map(ex=>{ const meta=EXMAP[ex.id]||{}; const setsTxt=ex.sets.map(s=>`${s.weight}×${s.reps}`).join('  ');
          return `<div class="lift"><div class="liftmark">${meta.icon||'🏋️'}</div><div class="grow" style="min-width:0;"><div style="font-weight:700;">${meta.name||'Exercise'}</div><div class="tiny muted">${ex.sets.length} set${ex.sets.length===1?'':'s'} · ${setsTxt}</div></div></div>`;
        }).join('')}
      </div></div>
    </div>
    ${(function(){ const pr=countPRs({start:a.start,exercises:exs}); const est=shardsForSession({start:a.start,end:Date.now(),exercises:exs},pr);
      return `<div class="card flat" style="padding:11px 14px;margin:0 0 14px;display:flex;align-items:center;gap:9px;">${shardSVG(19)}<div style="font-weight:800;font-size:14px;">+${est.gain} Shards</div><div class="tiny muted" style="margin-left:auto;">${est.mins}m · ${est.sets} sets${pr?` · ${pr} PR <span style="color:var(--warn);">${icon('trophy',13)}</span>`:''}${est.mult>1?' · ×1.1 '+flameSVG(13):''}</div></div>`; })()}
    ${(!S.stk&&S.stkLost)?`<div class="card flat" style="padding:12px 14px;margin:0 0 14px;border:1px solid #4a2030;">
      <div class="tiny" style="color:var(--bad);font-weight:700;line-height:1.45;">💔 Your ${S.stkLost.count}-day streak is still revivable — finishing this workout starts a new streak at day 1 and the old one expires for good.</div>
      <button class="btn ghost sm" style="margin-top:9px;" onclick="closeModal('finishModal');openStreaks()">View revive options</button>
    </div>`:''}
    <label class="f">Bodyweight today (${S.units})</label>
    <input id="finBW" type="number" inputmode="decimal" value="${S.bw||''}" style="margin-bottom:6px;">
    <div class="tiny muted" style="margin-bottom:16px;">Logged with this session — keeps your strength rank accurate.</div>
    <div class="card flat" style="padding:13px 15px;margin-bottom:0;">
      <div class="row sb"><div><div style="font-weight:700;">Share to feed</div><div class="tiny muted">Post this workout + bodygraph</div></div>
        <button class="chip ${finShare?'on':''}" onclick="toggleFinShare()">${finShare?'✓ On':'Off'}</button></div>
      ${finShare?`<textarea id="finCap" rows="2" placeholder="Add a caption…" oninput="finCapText=this.value" style="margin-top:10px;">${escapeAttr(finCapText)}</textarea>
        ${finMedia?`<div style="position:relative;margin-top:10px;"><img src="${finMedia}" style="width:100%;border-radius:12px;display:block;"><button class="btn danger sm" style="position:absolute;top:8px;right:8px;padding:6px 10px;" onclick="finMedia=null;renderFinishReview();">✕</button></div>`:''}
        <label class="btn ghost sm" style="margin-top:10px;display:block;text-align:center;cursor:pointer;">${icon('camera',16)} Add photo<input type="file" accept="image/*" style="display:none;" onchange="pickFinMedia(this)"></label>`:''}
    </div>
    <div class="modecard soon" style="margin-top:10px;"><div class="row sb"><div class="row" style="gap:12px;"><div class="modeic">🟧</div><div><div style="font-weight:800;">Post to Strava</div><div class="tiny muted">Auto-sync your session</div></div></div><div class="soonbadge">Coming soon…</div></div></div>
    <button class="btn good" style="margin-top:14px;" onclick="commitFinish()">Finish workout</button>
    <button class="btn ghost" style="margin-top:8px;" onclick="closeModal('finishModal')">Keep training</button>`;
}
function commitFinish(){
  const a=S.active; if(!a) return;
  const bw=+document.getElementById('finBW').value; if(bw>0) S.bw=bw;
  a.exercises.forEach(ex=> ex.sets=ex.sets.filter(s=>s.weight&&s.reps));
  a.exercises=a.exercises.filter(ex=>ex.sets.length);
  if(!a.exercises.length){ toast('No completed sets'); return; }
  a.end=Date.now(); a.bw=S.bw;
  if(S.boost){ a.xpMult=S.boost; S.boost=null; }      // consume an active XP shake
  const prCount=countPRs(a);
  const beforeDet=rankDetail(overallSR()), xpBefore=totalXP(), lvlBefore=levelInfo(xpBefore).level;
  S.sessions.push(a); S.active=null; rest=0;
  if(window.cloud && cloud.ready()) cloud.mark('sessions', a.start);
  bumpStreak();
  const shard=shardsForSession(a, prCount);
  S.shards=(S.shards||0)+shard.gain;
  const afterDet=rankDetail(overallSR()), xpAfter=totalXP(), lvlAfter=levelInfo(xpAfter).level;
  const cap=finShare?((document.getElementById('finCap')||{}).value || finCapText || '').trim():null;
  const workoutPayload={title:guessSplit(a), sets:a.exercises.reduce((x,e)=>x+e.sets.length,0), vol:sessionVolume(a), act:activationForSession(a), units:S.units};
  if(window.cloud && cloud.ready()){
    // Feed is user-posts only: post ONLY when the user opted into "Share to feed". No automatic rank-up / PR posts.
    if(finShare){ cloud.createPost('post', {caption:cap, workout:workoutPayload}, finMedia).then(()=>refreshFeed()).catch(()=>{}); }
  } else if(finShare){
    S.posts=S.posts||[];
    S.posts.unshift({type:'post', caption:cap, media:finMedia, workout:workoutPayload, when:'now', likes:0, comments:0, ts:Date.now()});
    if(S.posts.length>20) S.posts.length=20;
  }
  try{ save(); }catch(e){}
  closeModal('finishModal'); renderTrain();
  const xpGain=xpAfter-xpBefore;
  if(rankOrdinal(afterDet)>rankOrdinal(beforeDet)){ celReturn='rank'; haptic([0,70,50,90]); celebrateRankUp(beforeDet,afterDet); return; }
  go('rank');
  setTimeout(()=>{
    const shardBit=` · +${shard.gain} Shards${prCount?` · ${prCount} PR${prCount>1?'s':''} <span style="color:var(--warn);">${icon('trophy',13)}</span>`:''}${a.xpMult?` · ${a.xpMult}× shake ${icon('shaker',13)}`:''}`;
    if(lvlAfter>lvlBefore) toast(`⬆️ Level ${lvlAfter}! +${xpGain} XP${shardBit}`);
    else toast(`Session saved · +${xpGain} XP${shardBit}`);
  },350);
}

// ---------- Rest & session timers ----------
let rest=0, REST_DEFAULT=120;
function startRest(){ rest=REST_DEFAULT; renderTimers(); }
function addRest(n){ rest=Math.max(0,rest+n); renderTimers(); }
function skipRest(){ rest=0; renderTimers(); }
function renderTimers(){
  if(S.active){ const t=fmtClock(Date.now()-S.active.start);
    ['sessTimer','focusTimer','focusMiniTimer'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=t; });
  }
  const rw=document.getElementById('restWrap');
  if(rw){
    if(rest>0){ rw.style.display='block';
      rw.innerHTML=`<div class="rest"><div>🛌</div><div class="grow"><div class="tiny muted">Rest</div><div class="t">${fmtClock(rest*1000)}</div></div>
        <button class="btn ghost sm" onclick="addRest(-15)">-15</button>
        <button class="btn ghost sm" onclick="addRest(15)">+15</button>
        <button class="btn sm" onclick="skipRest()">Skip</button></div>`;
    } else rw.style.display='none';
  }
}
setInterval(()=>{ if(rest>0){ rest--; if(rest===0) toast('Rest over 💪'); } renderTimers(); },1000);

// ---------- Focus mode ----------
// While a workout is active the #focusSheet takes over the screen. It can be minimized to a
// mini bar (state 'min') so the rest of the app is usable, or hidden entirely when no session.
let focusState='hidden';   // 'hidden' | 'expanded' | 'min'
function applyFocus(){
  const sheet=document.getElementById('focusSheet'), mini=document.getElementById('focusMini');
  if(!sheet||!mini) return;
  sheet.classList.toggle('show', focusState==='expanded');
  mini.classList.toggle('show', focusState==='min');
  sheet.setAttribute('aria-hidden', focusState==='expanded' ? 'false' : 'true');
}
function showFocus(){ if(focusState==='hidden') focusState='expanded'; applyFocus(); }   // don't yank a minimized user back open
function hideFocus(){ focusState='hidden'; applyFocus(); }
function expandFocus(){ if(!S.active || focusState==='expanded') return; focusState='expanded'; applyFocus(); haptic([0,14]); }
function minimizeFocus(){ if(!S.active || focusState==='min') return; focusState='min'; applyFocus(); haptic([0,22]); }

// Swipe the header down to minimize; snaps back if the drag is short.
(function(){
  const head=document.getElementById('focusHead'); if(!head) return;
  const sheet=()=>document.getElementById('focusSheet');
  let y0=null, dy=0;
  head.addEventListener('touchstart', e=>{ y0=e.touches[0].clientY; dy=0; const s=sheet(); if(s) s.style.transition='none'; }, {passive:true});
  head.addEventListener('touchmove', e=>{ if(y0==null) return; dy=Math.max(0, e.touches[0].clientY-y0); const s=sheet(); if(s) s.style.transform='translateY('+dy+'px)'; if(dy>0) e.preventDefault(); }, {passive:false});
  head.addEventListener('touchend', ()=>{ const s=sheet(); if(s){ s.style.transition=''; s.style.transform=''; } if(dy>90) minimizeFocus(); y0=null; dy=0; });
})();
// Swipe the mini bar up (or tap it) to return to focus.
(function(){
  const mini=document.getElementById('focusMini'); if(!mini) return;
  let y0=null;
  mini.addEventListener('touchstart', e=>{ y0=e.touches[0].clientY; }, {passive:true});
  mini.addEventListener('touchend', e=>{ if(y0!=null){ const dy=e.changedTouches[0].clientY-y0; if(dy<-24) expandFocus(); } y0=null; });
})();

// ---------- Exercise picker ----------
let pickerTarget='active', pickSort='alpha', pickGroup='All';
function openExPicker(target){ pickerTarget=target||'active'; document.getElementById('exSearch').value=''; pickSort='alpha'; pickGroup='All'; demoOpen.clear();
  document.getElementById('exTitle').textContent= target==='routine'?'Add to routine':'Add exercise';
  renderSortChips(); renderGroupChips(); renderExOptions(); openModal('exModal'); }
function renderSortChips(){
  const opts=[['alpha','A–Z'],['rank','By Rank'],['performed','Performed']];
  document.getElementById('exSort').innerHTML=opts.map(([k,l])=>`<div class="chip ${k===pickSort?'on':''}" onclick="setPickSort('${k}')">${l}</div>`).join('');
}
function renderGroupChips(){
  document.getElementById('exGroups').innerHTML=['All',...GROUPS].map(g=>`<div class="chip ${g===pickGroup?'on':''}" onclick="setPickGroup('${g}')">${g}</div>`).join('');
}
function setPickSort(k){ pickSort=k; renderSortChips(); renderExOptions(); }
function setPickGroup(g){ pickGroup=g; renderGroupChips(); renderExOptions(); }
function renderExOptions(){
  const q=(document.getElementById('exSearch').value||'').toLowerCase();
  const best=bestLifts();
  let list=EXERCISES.filter(e=>(pickGroup==='All'||e.group===pickGroup)&&(e.name.toLowerCase().includes(q)||e.group.toLowerCase().includes(q)));
  if(pickSort==='performed') list=list.filter(e=>best[e.id]!=null);
  if(pickSort==='rank') list=list.slice().sort((a,b)=>(liftScore(b.id,(best[b.id]||{}).w||0))-(liftScore(a.id,(best[a.id]||{}).w||0)));
  const el=document.getElementById('exList');
  if(!list.length){ el.innerHTML=`<div class="empty">No exercises found.</div>`; return; }
  el.innerHTML=list.map(e=>{
    let badge='';
    if(best[e.id]!=null){ const rk=rankFor(liftSR(liftScore(e.id,best[e.id].w))); badge=`<div style="flex-shrink:0;">${rankEmblem(rk,22)}</div>`; }
    const open=demoOpen.has(e.id);
    return `<div>
      <div class="exopt" style="${open?'margin-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;':''}" onclick="pickExercise('${e.id}')">
        <div style="width:44px;height:58px;border-radius:12px;overflow:hidden;background:#0c0c12;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${exDemoBody(e.id, 54)}</div>
        <div class="grow"><div style="font-weight:700;">${e.name}${e.custom?' <span style="font-size:9px;font-weight:900;color:var(--warn);border:1px solid var(--warn);border-radius:5px;padding:1px 4px;vertical-align:2px;">CUSTOM</span>':''}</div><div class="tiny muted">${e.group}${e.custom?' · pending review':''}</div></div>
        ${badge}
        <button onclick="event.stopPropagation();toggleDemo('${e.id}')" style="background:var(--card2);border:1px solid var(--line2);border-radius:999px;color:${open?'var(--accent2)':'var(--mut)'};font-size:11px;font-weight:700;padding:6px 11px;flex-shrink:0;">${open?'Hide':'Demo'}</button>
        <div class="muted" style="margin-left:4px;">＋</div>
      </div>
      ${open?`<div style="border:1px solid var(--line2);border-top:none;border-radius:0 0 14px 14px;margin:0 0 8px;overflow:hidden;background:var(--card);">${exDemoPhoto(e.id)}</div>`:''}
    </div>`;
  }).join('');
}
function pickExercise(id){
  if(pickerTarget==='challenge'){ createChallenge(id); return; }
  if(pickerTarget==='routine'){ routineDraft.items.push({id,sets:3}); renderRoutineDraft(); toast(EXMAP[id].name+' added'); return; }
  if(!S.active) startWorkout();
  S.active.exercises.push({id, sets:[{weight:'',reps:'',done:false}]}); save(); closeModal('exModal'); renderTrain();
}

// ---------- Routines ----------
let routineDraft=null;
function newRoutine(){ routineDraft={name:'',items:[]}; document.getElementById('rtName').value=''; renderRoutineDraft(); openModal('routineModal'); }
function syncRoutineName(v){ if(routineDraft) routineDraft.name=v; }
function renderRoutineDraft(){
  const el=document.getElementById('rtItems');
  if(!routineDraft.items.length){ el.innerHTML=`<div class="empty">No exercises yet.</div>`; return; }
  el.innerHTML=routineDraft.items.map((it,i)=>`<div class="card flat" style="padding:11px 13px;"><div class="row sb">
    <div class="row" style="gap:10px;"><div class="liftmark">${EXMAP[it.id].icon}</div><div style="font-weight:700;">${EXMAP[it.id].name}</div></div>
    <div class="row" style="gap:8px;">
      <div class="stepper"><button onclick="rtSets(${i},-1)">−</button><div class="n">${it.sets}</div><button onclick="rtSets(${i},1)">＋</button></div>
      <button class="btn danger sm" style="padding:7px 9px;" onclick="rtRemove(${i})">✕</button>
    </div></div><div class="tiny muted" style="margin-top:4px;">${it.sets} sets</div></div>`).join('');
}
function rtSets(i,d){ routineDraft.items[i].sets=Math.max(1,Math.min(10,routineDraft.items[i].sets+d)); renderRoutineDraft(); }
function rtRemove(i){ routineDraft.items.splice(i,1); renderRoutineDraft(); }
function saveRoutine(){
  if(!routineDraft.name.trim()){ toast('Name your routine'); return; }
  if(!routineDraft.items.length){ toast('Add an exercise'); return; }
  S.routines.push({name:routineDraft.name.trim(), items:routineDraft.items}); save();
  if(window.cloud && cloud.ready()) cloud.mark('routines');
  closeModal('routineModal'); renderTrain(); toast('Routine saved');
}
function delRoutine(ri){ const rt=S.routines[ri]; confirmDialog({ title:'Delete routine?', message:rt?('“'+escapeAttr(rt.name)+'” will be removed from your routines.'):'', confirmText:'Delete', onConfirm:()=>{ S.routines.splice(ri,1); save(); if(window.cloud && cloud.ready()) cloud.mark('routines'); renderTrain(); toast('Routine deleted'); } }); }
function startRoutine(ri){
  const rt=S.routines[ri];
  S.active={start:Date.now(), exercises:rt.items.map(it=>({id:it.id, sets:Array.from({length:it.sets},()=>({weight:'',reps:'',done:false}))}))};
  save(); renderTrain(); toast('Started: '+rt.name);
}

// ---------- Generate workout ----------
const FOCUS=[
  {key:'Push',  groups:['Chest','Shoulders','Arms']},
  {key:'Pull',  groups:['Back','Arms']},
  {key:'Legs',  groups:['Legs']},
  {key:'Upper', groups:['Chest','Back','Shoulders','Arms']},
  {key:'Lower', groups:['Legs','Core']},
  {key:'Full Body', groups:['Chest','Back','Legs','Shoulders','Arms','Core']},
];
function openGenerate(){
  document.getElementById('genFocus').innerHTML=FOCUS.map((f,i)=>`<button class="btn ghost" style="margin-bottom:8px;text-align:left;" onclick="generate(${i})">${f.key}</button>`).join('');
  openModal('genModal');
}
function generate(fi){
  const f=FOCUS[fi]; const chosen=[];
  f.groups.forEach(g=>{
    const pool=EXERCISES.filter(e=>e.group===g).sort((a,b)=>b.w-a.w);
    // pick the top compound + one random accessory from the group
    if(pool[0]) chosen.push(pool[0].id);
    const rest=pool.slice(1); if(rest.length){ chosen.push(rest[Math.floor(Math.random()*rest.length)].id); }
  });
  const uniq=[...new Set(chosen)].slice(0, f.key==='Full Body'?7:6);
  S.active={start:Date.now(), exercises:uniq.map(id=>({id, sets:Array.from({length:3},()=>({weight:'',reps:'',done:false}))}))};
  save(); closeModal('genModal'); renderTrain(); toast('⚡ '+f.key+' workout generated');
}

