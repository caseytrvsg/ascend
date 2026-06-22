// ---------- PROFILE ----------
// ---------- Pro (subscription gate) ----------
function openPro(){
  const feats=[[icon('chart',22),'All-time stats','Duration, volume & reps across your whole history'],
    [icon('calendar',22),'30-day & longer charts','See trends beyond the free 2 weeks'],
    [icon('trophy',22),'Advanced rank insights','Per-muscle history & progress projections'],
    [icon('cloud',22),'Cloud backup','Sync your data across devices']];
  document.getElementById('proSheet').innerHTML=`<div class="grab"></div>
    <div style="text-align:center;">
      <div style="font-size:42px;">⭐</div>
      <h2 style="margin:6px 0 2px;">ASCEND <span style="color:var(--warn);">Pro</span></h2>
      <p class="sub" style="margin-bottom:16px;">Unlock your full training history & more.</p>
    </div>
    ${feats.map(f=>`<div class="row" style="gap:13px;padding:9px 2px;"><div style="font-size:22px;">${f[0]}</div><div><div style="font-weight:700;">${f[1]}</div><div class="tiny muted">${f[2]}</div></div></div>`).join('')}
    <button class="btn" style="margin-top:16px;background:var(--warn);color:#1a1206;" onclick="upgradeProDemo()">Upgrade to Pro</button>
    <div class="tiny muted" style="text-align:center;margin-top:8px;">Prototype — unlocks instantly. The real app bills through the App Store / Google Play.</div>
    <button class="btn ghost" style="margin-top:8px;" onclick="closeModal('proModal')">Maybe later</button>`;
  openModal('proModal');
}
function upgradeProDemo(){ S.pro=true; save(); closeModal('proModal'); haptic([0,40,40,80]); toast('Pro unlocked ⭐'); renderProfile(); }
function setPro(b){ S.pro=b; save(); if(document.getElementById('settingsScreen').classList.contains('show')) renderSettings(); renderProfile(); toast(b?'Pro enabled':'Pro disabled'); }
function renderProfile(){
  const sr=overallSR(), det=rankDetail(sr), r=det.rank;
  document.getElementById('pfName').textContent=S.name;
  document.getElementById('pfAvatar').textContent=(S.name||'A').slice(0,1).toUpperCase();
  document.getElementById('pfRankLine').innerHTML=`<span style="color:${r.color}">${r.name}${det.division?' '+det.division:''}</span> · ${det.ascended?det.sr+' SR':det.sr+' / 100 SR'}`;
  document.getElementById('pfBadge').innerHTML=rankEmblem(r,40,det.division);
  document.getElementById('pfGoal').textContent=S.goal||'—';
  const mt=macroTargets(); document.getElementById('pfCals').textContent=mt.kcal+' kcal'+(mt.custom?' (custom)':'');
  const bmi=bmiInfo(); document.getElementById('pfBMI').textContent=bmi?(bmi.bmi+' · '+bmi.cat):'—';
  renderActChart(); renderMuscleCard(); renderStreaksCard(); renderInvCard(); renderLevelsCard();
}
// ---------- Profile activity cards (own design) ----------
function last7Days(){ const t=new Date(); t.setHours(0,0,0,0); const a=[]; for(let i=6;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); a.push(d); } return a; }
function dayAgg(){ const m={}; S.sessions.forEach(s=>{ const k=new Date(s.start); k.setHours(0,0,0,0); const key=k.getTime(); const a=m[key]||(m[key]={dur:0,vol:0,reps:0});
  a.dur+=s.end?(s.end-s.start):0; s.exercises.forEach(ex=>ex.sets.forEach(st=>{ a.vol+=(+st.weight||0)*(+st.reps||0); a.reps+=(+st.reps||0); })); }); return m; }
let actMetric='dur', actDays=14, actMenu=false, actSel=-1;
function setActMetric(m){ actMetric=m; actSel=-1; renderActChart(); }
const PRO_DAYS=[30,'all'];   // first 2 weeks free; longer ranges are Pro
function setActDays(n){ if(PRO_DAYS.includes(n)&&!S.pro){ actMenu=false; renderActChart(); openPro(); return; } actDays=n; actMenu=false; actSel=-1; renderActChart(); }
function effDays(){ if(actDays!=='all') return actDays; if(!S.sessions.length) return 14;
  const t=new Date(); t.setHours(0,0,0,0); const e=new Date(Math.min(...S.sessions.map(s=>s.start))); e.setHours(0,0,0,0);
  return Math.min(365, Math.round((t-e)/864e5)+1); }
function toggleActMenu(){ actMenu=!actMenu; renderActChart(); }
function selectBar(i){ actSel=(actSel===i?-1:i); renderActChart(); }
function fmtHMS(ms){ const s=Math.round(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60), ss=s%60; return (h?h+'h ':'')+(h||m?m+'m ':'')+ss+'s'; }
function renderActChart(){
  const N=effDays(), t=new Date(); t.setHours(0,0,0,0);
  const days=[]; for(let i=N-1;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); days.push(d); }
  const agg=dayAgg();
  const rawOf=d=>{ const a=agg[d.getTime()]||{}; return actMetric==='dur'?(a.dur||0) : actMetric==='vol'?(a.vol||0) : (a.reps||0); };
  const raws=days.map(rawOf), dispOf=v=>actMetric==='dur'?v/60000:v, vals=raws.map(dispOf);
  const max=Math.max(1,...vals), total=raws.reduce((a,b)=>a+b,0);
  const fmtTotal = actMetric==='dur'?fmtHMS(total) : actMetric==='vol'?fmt(total)+' '+S.units : total.toLocaleString()+' reps';
  const fmtY=v=>actMetric==='dur'?(v>=60?Math.floor(v/60)+'h'+(Math.round(v%60)||''):Math.round(v)+'m') : actMetric==='vol'?fmt(v) : Math.round(v);
  const fmtBar=v=>actMetric==='dur'?fmtHMS(v):actMetric==='vol'?fmt(v)+' '+S.units:v+' reps';
  const ticks=[1,.75,.5,.25,0].map(f=>f*max);
  const grid=ticks.map((tk,i)=>`<div style="position:absolute;left:34px;right:0;top:${i/4*100}%;border-top:1px dashed var(--line2);"></div><div class="tiny muted" style="position:absolute;left:0;top:${i/4*100}%;transform:translateY(-50%);">${fmtY(tk)}</div>`).join('');
  const every=Math.ceil(N/7), bw=N>20?'12px':'24px';
  const bars=days.map((d,i)=>{ const has=raws[i]>0, h=has?Math.max(2,vals[i]/max*100):1, sel=actSel===i;
    return `<div onclick="event.stopPropagation();selectBar(${i})" style="flex:1;height:100%;display:flex;align-items:flex-end;position:relative;cursor:pointer;">
      ${sel?`<div style="position:absolute;bottom:calc(${h}% + 5px);left:50%;transform:translateX(-50%);background:var(--bg2);border:1px solid var(--accent);border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;white-space:nowrap;z-index:3;">${fmtBar(raws[i])}</div>`:''}
      <div style="width:100%;max-width:${bw};margin:0 auto;height:${h}%;border-radius:6px 6px 0 0;background:${has?'linear-gradient(180deg,var(--accent2),var(--accent))':'var(--card2)'};${sel?'box-shadow:0 0 0 2px #fff;':''}"></div>
    </div>`; }).join('');
  const labels=days.map((d,i)=>`<div style="flex:1;text-align:center;" class="tiny muted">${i%every===0?('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2):''}</div>`).join('');
  document.getElementById('actChart').innerHTML=`
    <div class="row sb" style="margin-bottom:14px;">
      <div class="row" style="gap:9px;"><svg width="22" height="24" viewBox="0 0 58 64"><polygon points="29,3 54,18 54,46 29,61 4,46 4,18" fill="var(--card2)" stroke="var(--accent)" stroke-width="3"/></svg><div style="font-weight:800;font-size:16px;">Total ${fmtTotal}</div></div>
      <div style="position:relative;">
        <div onclick="event.stopPropagation();toggleActMenu()" class="tiny" style="color:var(--mut);font-weight:700;cursor:pointer;">${actDays==='all'?'All time':'Last '+actDays+' Days'} ▾</div>
        ${actMenu?`<div style="position:absolute;right:0;top:24px;background:var(--bg2);border:1px solid var(--line2);border-radius:12px;overflow:hidden;z-index:6;min-width:150px;box-shadow:0 12px 30px -10px #000;">${[{v:7,l:'Last 7 Days'},{v:14,l:'Last 14 Days'},{v:30,l:'Last 30 Days',pro:1},{v:'all',l:'All time',pro:1}].map((o,idx,arr)=>`<div onclick="event.stopPropagation();setActDays(${typeof o.v==='string'?`'${o.v}'`:o.v})" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;font-size:13px;font-weight:600;color:${o.v===actDays?'var(--accent2)':'var(--txt)'};${idx<arr.length-1?'border-bottom:1px solid var(--line);':''}">${o.l}${o.pro&&!S.pro?'<span style="font-size:10px;font-weight:800;color:var(--warn);">PRO 🔒</span>':''}</div>`).join('')}</div>`:''}
      </div>
    </div>
    <div class="seg" style="margin-bottom:16px;">
      <button class="${actMetric==='dur'?'on':''}" onclick="setActMetric('dur')">Duration</button>
      <button class="${actMetric==='vol'?'on':''}" onclick="setActMetric('vol')">Volume</button>
      <button class="${actMetric==='reps'?'on':''}" onclick="setActMetric('reps')">Reps</button>
    </div>
    <div style="position:relative;height:150px;">${grid}<div style="position:absolute;left:34px;right:0;top:0;bottom:0;display:flex;align-items:flex-end;gap:${N>20?2:4}px;">${bars}</div></div>
    <div style="display:flex;gap:${N>20?2:4}px;margin:8px 0 0 34px;">${labels}</div>`;
}
function curWeek(){ const t=new Date(); t.setHours(0,0,0,0); const s=new Date(t); s.setDate(s.getDate()-t.getDay());
  const a=[]; for(let i=0;i<7;i++){ const d=new Date(s); d.setDate(s.getDate()+i); a.push(d); } return a; }
function bestStreak(){
  const days=trainedDayList(), lost=S.stkLost?S.stkLost.count:0;
  if(!days.length) return Math.max(streakCount(), lost);
  let best=0, start=days[0];
  for(let i=1;i<=days.length;i++){
    if(i===days.length || days[i]-days[i-1]>STREAK_GRACE*DAY){
      best=Math.max(best, Math.round((days[i-1]-start)/DAY)+1);
      if(i<days.length) start=days[i];
    }
  }
  return Math.max(best, streakCount(), lost);
}
function streakMessage(cur){ return cur>=7?"Unstoppable — keep the chain alive! 🔥" : cur>=3?"You're on a roll. Keep it up!" : cur>=1?"Nice start — come back tomorrow!" : "Train today to start a streak."; }
function renderStreaksCard(){
  const week=curWeek(), done=new Set(S.sessions.map(s=>new Date(s.start).toDateString())), todayStr=new Date().toDateString(), cur=streakInfo(), L=['S','M','T','W','T','F','S'];
  const circles=week.map(d=>{ const isDone=done.has(d.toDateString()), isToday=d.toDateString()===todayStr;
    return `<div style="flex:1;text-align:center;">
      <div class="tiny" style="color:${isToday?'var(--warn)':'var(--mut2)'};font-weight:700;">${L[d.getDay()]}</div>
      <div style="width:34px;height:34px;border-radius:50%;margin:7px auto 0;display:flex;align-items:center;justify-content:center;background:${isDone?'var(--warn)':'var(--card2)'};border:2px solid ${isToday?'var(--warn)':'transparent'};">${isDone?flameSVG(17):''}</div>
    </div>`; }).join('');
  document.getElementById('streaksBody').innerHTML=`
    <div class="row sb" style="margin-bottom:14px;"><h2 style="margin:0;">${flameSVG(19)} Streaks</h2><span onclick="openStreaks()" style="color:var(--accent2);font-weight:700;font-size:14px;cursor:pointer;">View More ›</span></div>
    <div style="display:flex;gap:4px;">${circles}</div>
    <div class="card flat" style="margin-top:16px;padding:14px;display:flex;gap:14px;align-items:center;">
      <div style="text-align:center;flex-shrink:0;"><div style="font-size:24px;font-weight:900;display:flex;align-items:center;gap:4px;justify-content:center;">${flameSVG(22)} ${bestStreak()}</div><div class="tiny muted">Best</div></div>
      <div class="grow" style="font-weight:600;font-size:14px;">${(!S.stk&&S.stkLost)?'Streak lost at '+S.stkLost.count+' days 💔 — revive it from your Inventory below.':streakMessage(cur)}</div>
    </div>`;
}

// ---------- Streaks screen (View More) ----------
let streakMonth=0; // months back from current month (0 = this month)
const STREAK_MILES=[7,14,30,60,100,180,365];
function openStreaks(){ streakMonth=0; document.getElementById('streakScreen').classList.add('show'); renderStreakScreen(); }
function closeStreaks(){ document.getElementById('streakScreen').classList.remove('show'); }
function streakNav(delta){ const n=streakMonth+delta; if(n<0) return; streakMonth=n; renderStreakScreen(); }
function renderStreakScreen(){
  const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cur=streakInfo(), best=bestStreak();
  const dayset=new Set(S.sessions.map(s=>{const d=new Date(s.start);d.setHours(0,0,0,0);return d.getTime();}));
  const totalDays=dayset.size;
  const last=STREAK_MILES[STREAK_MILES.length-1];
  const next=STREAK_MILES.find(m=>m>cur)||last;
  const prevM=[...STREAK_MILES].filter(m=>m<=cur).pop()||0;
  const toNext=Math.max(0,next-cur);
  const segPct=next>prevM?Math.min(1,(cur-prevM)/(next-prevM)):1;
  const allDone=cur>=last;
  // banner: alive (with at-risk warning + freeze badge) vs lost (revive actions)
  const gap=streakGap(), daysLeft=STREAK_GRACE-gap+1, lost=!S.stk&&S.stkLost, freezes=S.inv.freeze||0;
  let banner;
  if(lost){
    const revives=['rest30','rest60','phoenix'].filter(id=>(S.inv[id]||0)>0&&S.stkLost.count<=reviveCap(id));
    banner=`<div style="background:linear-gradient(135deg,#2a2a36,#15151d);border:1px solid var(--line2);border-radius:18px;padding:22px 20px;position:relative;overflow:hidden;">
      <div style="font-size:52px;font-weight:900;line-height:1;color:var(--mut);">${S.stkLost.count}</div>
      <div style="font-weight:800;font-size:18px;margin-top:2px;">day streak lost 💔</div>
      <div style="font-size:13px;color:var(--mut);margin-top:8px;max-width:70%;">Don't let it end here — revive it and keep climbing.</div>
      <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap;">
        ${revives.map(id=>`<button class="btn sm" onclick="useItem('${id}')">${id==='phoenix'?flameSVG(14,'phoenix')+' Phoenix':flameSVG(14)+' '+findItem(id).name}</button>`).join('')}
        <button class="btn ghost sm" onclick="closeStreaks();openStore()">Get a revive ›</button>
      </div>
      <div style="position:absolute;right:10px;top:24px;opacity:.2;">${flameSVG(72)}</div>
    </div>`;
  } else {
    const warn=(cur&&gap>=2)?`<div style="margin-top:12px;display:inline-flex;align-items:center;gap:7px;background:rgba(0,0,0,.28);border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:800;color:#ffd9a8;">⚠️ ${gap>=STREAK_GRACE?'Last chance — train today or lose your streak!':'Train within '+daysLeft+' days to keep your streak'}</div>`:'';
    const fz=freezes?`<div style="position:absolute;right:14px;bottom:12px;font-size:12px;font-weight:800;color:#cfeaff;background:rgba(0,0,0,.3);border-radius:9px;padding:5px 9px;">${icon('snowflake',13)} ×${freezes}</div>`:'';
    banner=`<div style="background:linear-gradient(135deg,#d2691e,#7a2f0c);border-radius:18px;padding:22px 20px;position:relative;overflow:hidden;">
      <div style="font-size:52px;font-weight:900;line-height:1;color:#fff;">${cur}</div>
      <div style="font-weight:800;font-size:18px;color:#fff;margin-top:2px;">day streak!</div>
      <div style="font-size:13px;color:rgba(255,255,255,.88);margin-top:8px;max-width:68%;">${streakMessage(cur)}</div>
      ${warn}
      <div style="position:absolute;right:8px;top:26px;opacity:.9;filter:drop-shadow(0 0 18px rgba(255,122,47,.45));">${flameSVG(88)}</div>${fz}
    </div>`;
  }
  // reward milestone tiles
  const tiles=STREAK_MILES.map(m=>{ const got=cur>=m, nx=(m===next&&!got);
    return `<div style="flex:1;min-width:40px;text-align:center;">
      <div style="font-size:22px;line-height:1;opacity:${got?1:.3};filter:${got?'none':'grayscale(1)'};">🎁</div>
      <div class="tiny" style="margin-top:5px;font-weight:${nx?800:600};color:${got?'var(--warn)':nx?'var(--accent2)':'var(--mut2)'};">${m}</div>
    </div>`; }).join('');
  // calendar grid
  const now=new Date(); now.setHours(0,0,0,0);
  const base=new Date(now.getFullYear(), now.getMonth()-streakMonth, 1);
  const y=base.getFullYear(), mo=base.getMonth();
  const firstDow=new Date(y,mo,1).getDay(), dim=new Date(y,mo+1,0).getDate(), todayT=now.getTime();
  const frozenSet=new Set((S.stk&&S.stk.frozen)||[]);
  let cells=''; for(let i=0;i<firstDow;i++) cells+='<div></div>';
  for(let day=1;day<=dim;day++){
    const t=new Date(y,mo,day).getTime(), trained=dayset.has(t), frozen=!trained&&frozenSet.has(t), isToday=t===todayT, future=t>todayT;
    const bg=trained?'var(--warn)':frozen?'#1d3c58':future?'transparent':'var(--card2)';
    const col=trained?'#241402':frozen?'#9fd4ff':'var(--mut2)';
    const ring=isToday?'2px solid var(--accent2)':'2px solid transparent';
    cells+=`<div style="display:flex;align-items:center;justify-content:center;padding:2px 0;"><div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${frozen?15:13}px;font-weight:${trained?800:600};background:${bg};color:${col};border:${ring};opacity:${future?.45:1};">${frozen?'<span style="color:#9fd8ff;">'+icon('snowflake',15)+'</span>':day}</div></div>`;
  }
  const wk=['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div class="tiny" style="text-align:center;color:var(--mut2);font-weight:700;padding-bottom:4px;">${d}</div>`).join('');
  document.getElementById('streakScreen').innerHTML=`
    <div class="anhead"><button onclick="closeStreaks()" style="background:none;color:var(--txt);font-size:24px;width:34px;flex-shrink:0;">←</button><div class="grow" style="text-align:center;font-weight:800;font-size:17px;">Streaks</div><div style="width:34px;"></div></div>
    <div class="anbody">
      ${banner}
      <div class="card" style="margin-top:14px;">
        <div class="row sb" style="margin-bottom:2px;"><div style="font-weight:800;">Streak Rewards</div><div class="tiny muted">${allDone?'All rewards unlocked 🎉':toNext+' day'+(toNext===1?'':'s')+' to '+next+'-day chest'}</div></div>
        <div class="barbg" style="height:9px;margin:8px 0 14px;"><div class="barfill" style="width:${Math.round(segPct*100)}%;background:linear-gradient(90deg,#f59e0b,#f97316);"></div></div>
        <div style="display:flex;gap:4px;">${tiles}</div>
      </div>
      <div class="statgrid" style="margin-top:14px;">
        <div class="stat"><div class="v" style="display:flex;align-items:center;gap:4px;justify-content:center;">${flameSVG(18)} ${best}</div><div class="l">Best Streak</div></div>
        <div class="stat"><div class="v">${totalDays}</div><div class="l">Total Days Trained</div></div>
      </div>
      <div class="card" style="margin-top:14px;">
        <div class="row sb" style="margin-bottom:12px;">
          <button onclick="streakNav(1)" style="background:none;color:var(--txt);font-size:22px;width:30px;flex-shrink:0;">‹</button>
          <div style="font-weight:800;font-size:15px;">${MN[mo]} ${y}</div>
          <button onclick="streakNav(-1)" style="background:none;color:${streakMonth===0?'var(--mut2)':'var(--txt)'};font-size:22px;width:30px;flex-shrink:0;">›</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);">${wk}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);">${cells}</div>
        <div class="tiny muted" style="text-align:center;margin-top:10px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--warn);vertical-align:-1px;"></span> Trained &nbsp; <span style="color:#9fd8ff;">${icon('snowflake',12)}</span> Frozen &nbsp;·&nbsp; rest days count while the chain lives (max ${STREAK_GRACE-1} in a row)</div>
      </div>
    </div>`;
}
function activationLastDays(n){
  const cutoff=Date.now()-n*864e5, act={}; GROUPS.forEach(g=>act[g]=0);
  S.sessions.forEach(s=>{ if(s.start>=cutoff){ const a=activationForSession(s); GROUPS.forEach(g=>act[g]+=a[g]); } });
  return act;
}
function renderMuscleCard(){
  const cf=actColorFn(activationLastDays(7));
  document.getElementById('muscleCard').innerHTML=`
    <div class="row sb" style="margin-bottom:6px;">
      <div class="row" style="gap:9px;"><svg width="22" height="24" viewBox="0 0 58 64"><polygon points="29,3 54,18 54,46 29,61 4,46 4,18" fill="var(--card2)" stroke="var(--accent)" stroke-width="3"/></svg><div style="font-weight:800;font-size:16px;">Muscles · Last 7 Days</div></div>
      <span onclick="openAnalysis()" style="color:var(--accent2);font-weight:700;font-size:14px;cursor:pointer;">View More ›</span>
    </div>
    <div style="display:flex;justify-content:center;gap:10px;align-items:flex-start;margin-top:8px;">${bodySVG('front',cf)}${bodySVG('back',cf)}</div>
    <div style="display:flex;margin-top:2px;"><div class="tiny muted" style="flex:1;text-align:center;">Front</div><div class="tiny muted" style="flex:1;text-align:center;">Back</div></div>
    <div class="tiny muted" style="text-align:center;margin-top:6px;">Brighter = more volume this week</div>`;
}

// ---------- Analysis screen (View More) ----------
let anDays=7, anOffset=0, anMenu=false;
const AN_ORDER=['Back','Chest','Core','Arms','Shoulders','Legs'];      // radar axis order (clockwise from top)
const AN_CARDS=['Core','Chest','Back','Legs','Shoulders','Arms'];
function openAnalysis(){ anOffset=0; anMenu=false; document.getElementById('analysisScreen').classList.add('show'); renderAnalysis(); }
function closeAnalysis(){ document.getElementById('analysisScreen').classList.remove('show'); }
function toggleAnMenu(){ anMenu=!anMenu; renderAnalysis(); }
function setAnDays(n){ if(PRO_DAYS.includes(n)&&!S.pro){ anMenu=false; renderAnalysis(); openPro(); return; } anDays=n; anOffset=0; anMenu=false; renderAnalysis(); }
function anPrev(){ anOffset++; renderAnalysis(); }
function anNext(){ if(anOffset>0) anOffset--; renderAnalysis(); }
function anPeriod(offset){
  const t=new Date(); t.setHours(0,0,0,0);
  if(anDays==='all'){ let s=new Date(t); if(S.sessions.length){ s=new Date(Math.min(...S.sessions.map(x=>x.start))); s.setHours(0,0,0,0);} else s.setDate(s.getDate()-13); return {start:s,end:t}; }
  const end=new Date(t); end.setDate(end.getDate()-offset*anDays);
  const start=new Date(end); start.setDate(start.getDate()-(anDays-1));
  return {start,end};
}
function setsInPeriod(p, byMuscle){
  const out={}; (byMuscle?[...new Set(EXERCISES.map(e=>exMuscle(e.id)))]:GROUPS).forEach(k=>out[k]=0);
  const s0=p.start.getTime(), e1=p.end.getTime()+864e5-1;
  S.sessions.forEach(se=>{ if(se.start>=s0&&se.start<=e1) se.exercises.forEach(ex=>{ const k=byMuscle?exMuscle(ex.id):EXMAP[ex.id].group; out[k]=(out[k]||0)+ex.sets.length; }); });
  return out;
}
function anDate(d){ return d.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]+' '+d.getFullYear(); }
function radarSVG(curr, prev){
  const cx=110,cy=108,R=80, max=Math.max(1,...AN_ORDER.map(g=>Math.max(curr[g]||0, prev[g]||0)));
  const P=(i,v)=>{ const a=(90-i*60)*Math.PI/180, r=R*(v/max); return [cx+r*Math.cos(a), cy-r*Math.sin(a)]; };
  const ring=f=>`<polygon points="${AN_ORDER.map((g,i)=>{const a=(90-i*60)*Math.PI/180;return (cx+R*f*Math.cos(a)).toFixed(1)+','+(cy-R*f*Math.sin(a)).toFixed(1);}).join(' ')}" fill="none" stroke="var(--line2)" stroke-width="1"/>`;
  const axes=AN_ORDER.map((g,i)=>{const a=(90-i*60)*Math.PI/180;return `<line x1="${cx}" y1="${cy}" x2="${(cx+R*Math.cos(a)).toFixed(1)}" y2="${(cy-R*Math.sin(a)).toFixed(1)}" stroke="var(--line2)" stroke-width="1"/>`;}).join('');
  const poly=(m,fill,stroke)=>`<polygon points="${AN_ORDER.map((g,i)=>{const[x,y]=P(i,m[g]||0);return x.toFixed(1)+','+y.toFixed(1);}).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  const labels=AN_ORDER.map((g,i)=>{const a=(90-i*60)*Math.PI/180, lx=cx+(R+15)*Math.cos(a), ly=cy-(R+15)*Math.sin(a), c=Math.cos(a); const anc=Math.abs(c)<.35?'middle':c>0?'start':'end'; return `<text x="${lx.toFixed(1)}" y="${(ly+4).toFixed(1)}" fill="var(--mut)" font-size="11" font-weight="600" text-anchor="${anc}">${g}</text>`;}).join('');
  return `<svg width="100%" viewBox="-36 -6 292 228" style="max-width:340px;display:block;margin:0 auto;">${[.25,.5,.75,1].map(ring).join('')}${axes}${poly(prev,'rgba(150,150,170,.10)','var(--mut2)')}${poly(curr,VOL_COLOR+'55',VOL_COLOR)}${labels}</svg>`;
}
function renderAnalysis(){
  const isAll=anDays==='all', p=anPeriod(anOffset), pPrev=anPeriod(anOffset+1);
  const curr=setsInPeriod(p), prev=isAll?{}:setsInPeriod(pPrev);
  const anLabel=isAll?'All time':'Last '+anDays+' Days';
  const menu=anMenu?`<div style="position:absolute;right:0;top:24px;background:var(--bg2);border:1px solid var(--line2);border-radius:12px;overflow:hidden;z-index:6;min-width:150px;box-shadow:0 12px 30px -10px #000;">${[{v:7,l:'Last 7 Days'},{v:14,l:'Last 14 Days'},{v:30,l:'Last 30 Days',pro:1},{v:'all',l:'All time',pro:1}].map((o,idx,arr)=>`<div onclick="event.stopPropagation();setAnDays(${typeof o.v==='string'?`'${o.v}'`:o.v})" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;font-size:13px;font-weight:600;color:${o.v===anDays?'var(--accent2)':'var(--txt)'};${idx<arr.length-1?'border-bottom:1px solid var(--line);':''}">${o.l}${o.pro&&!S.pro?'<span style="font-size:10px;font-weight:800;color:var(--warn);">PRO 🔒</span>':''}</div>`).join('')}</div>`:'';
  const cards=AN_CARDS.map(g=>{ const c=curr[g]||0, d=isAll?0:(c-(prev[g]||0));
    const delta=isAll?'':d>0?`<span style="color:var(--good);font-size:13px;font-weight:800;">${d} ▲</span>`:d<0?`<span style="color:var(--bad);font-size:13px;font-weight:800;">${Math.abs(d)} ▼</span>`:`<span class="muted" style="font-size:16px;">—</span>`;
    return `<div class="card flat" style="padding:14px;margin:0;"><div class="row sb" style="align-items:flex-start;"><div><div style="font-weight:800;font-size:17px;">${g}</div><div class="tiny muted" style="margin-top:3px;">${c} sets</div></div>${delta}</div></div>`; }).join('');
  const muscles=setsInPeriod(p, true), allM=[...new Set(EXERCISES.map(e=>exMuscle(e.id)))].sort();
  const list=allM.map(m=>`<div class="row sb" style="padding:13px 0;border-bottom:1px solid var(--line);"><div style="font-weight:600;color:${muscles[m]?'var(--txt)':'var(--mut2)'}">${m}</div><div style="font-weight:800;color:${muscles[m]?'var(--txt)':'var(--mut2)'}">${muscles[m]||0}</div></div>`).join('');
  document.getElementById('analysisScreen').innerHTML=`
    <div class="anhead">
      <button onclick="closeAnalysis()" style="background:none;color:var(--txt);font-size:24px;width:34px;flex-shrink:0;">←</button>
      <div class="grow" style="text-align:center;font-weight:800;font-size:17px;">Analysis</div>
      <div style="position:relative;flex-shrink:0;"><div onclick="event.stopPropagation();toggleAnMenu()" class="tiny" style="color:var(--mut);font-weight:700;cursor:pointer;padding:4px;">${anLabel} ▾</div>${menu}</div>
    </div>
    <div class="anbody">
      <div class="row" style="background:var(--card);border-radius:14px;padding:10px 8px;margin-bottom:18px;">
        <button onclick="anPrev()" ${isAll?'disabled style="opacity:.3;"':''} style="background:none;color:var(--accent2);font-size:22px;width:40px;">‹</button>
        <div class="grow" style="text-align:center;font-weight:700;font-size:15px;">${isAll?'All time':anDate(p.start)+' ~ '+anDate(p.end)}</div>
        <button onclick="anNext()" ${(anOffset===0||isAll)?'disabled style="opacity:.3;"':''} style="background:none;color:var(--accent2);font-size:22px;width:40px;">›</button>
      </div>
      ${radarSVG(curr,prev)}
      ${isAll?'':`<div class="row" style="justify-content:center;gap:18px;margin:14px 0 4px;">
        <div class="row" style="gap:6px;"><span style="width:18px;height:12px;border-radius:3px;background:${VOL_COLOR};display:inline-block;"></span><span class="tiny muted">Current</span></div>
        <div class="row" style="gap:6px;"><span style="width:18px;height:12px;border-radius:3px;background:var(--mut2);display:inline-block;"></span><span class="tiny muted">Previous</span></div>
      </div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">${cards}</div>
      <div class="row sb" style="margin:26px 0 4px;"><h2 style="margin:0;">Muscle Count</h2><div class="tiny muted" style="font-weight:700;">Sets</div></div>
      <div>${list}</div>
    </div>`;
}

// ---------- Settings (cog) ----------
let pushOn=false;
function openSettings(){ document.getElementById('settingsScreen').classList.add('show'); renderSettings();
  if(window.cloud&&cloud.ready()) cloud.pushEnabled().then(v=>{ if(v!==pushOn){ pushOn=v; if(document.getElementById('settingsScreen').classList.contains('show')) renderSettings(); } }); }
async function togglePush(){
  try{
    if(pushOn){ await cloud.disablePush(); pushOn=false; toast('Nudge notifications off'); }
    else { await cloud.enablePush(); pushOn=true; haptic([0,25,30,25]); toast('Nudge notifications on 🔔'); }
  }catch(e){
    const m=(e&&e.message)||'';
    toast(m==='push-denied'?'Notifications blocked — allow them for ASCEND in your phone settings'
      :m==='push-unsupported'?'Install ASCEND to your home screen first, then turn this on'
      :'Could not switch notifications — try again');
  }
  renderSettings();
}
function closeSettings(){ document.getElementById('settingsScreen').classList.remove('show'); renderProfile(); }
function comingSoon(){ toast('Coming soon'); }
function setRow(icon,label,opts){ opts=opts||{};
  const right=opts.right||'<span style="color:var(--mut2);font-size:18px;">›</span>';
  return `<div class="optrow" ${opts.onclick?`onclick="${opts.onclick}"`:''}><div class="ic" style="font-size:18px;">${icon}</div><div class="grow" style="font-weight:600;font-size:15px;${opts.color?'color:'+opts.color+';':''}">${label}</div>${right}</div>`;
}
function renderSettings(){
  const unitSeg=`<div class="seg" style="width:104px;" onclick="event.stopPropagation();"><button class="${S.units==='lb'?'on':''}" onclick="setUnits('lb')">lb</button><button class="${S.units==='kg'?'on':''}" onclick="setUnits('kg')">kg</button></div>`;
  const proSeg=`<div class="seg" style="width:92px;" onclick="event.stopPropagation();"><button class="${!S.pro?'on':''}" onclick="setPro(false)">Off</button><button class="${S.pro?'on':''}" onclick="setPro(true)">On</button></div>`;
  document.getElementById('settingsScreen').innerHTML=`
    <div class="anhead"><button onclick="closeSettings()" style="background:none;color:var(--txt);font-size:24px;width:34px;flex-shrink:0;">←</button><div class="grow" style="text-align:center;font-weight:800;font-size:17px;">Settings</div><div style="width:34px;"></div></div>
    <div class="anbody">
      <div class="card" onclick="openPro()" style="cursor:pointer;background:linear-gradient(90deg,#241c12,var(--card));border:1px solid #4a3a18;">
        <div class="row sb"><div class="row" style="gap:12px;"><span style="color:var(--warn);">${icon('star',24)}</span><div><div style="font-weight:800;">${S.pro?'ASCEND Pro — active':'Get ASCEND Pro'}</div><div class="tiny muted">${S.pro?'Manage your subscription':'Unlock all-time stats & more'}</div></div></div><span style="color:var(--mut2);font-size:18px;">›</span></div>
      </div>
      <div class="setsec">Account</div>
      ${window.cloud && cloud.ready()
        ? setRow(icon('cloud',19),'Signed in · '+escapeAttr((cloud.user()&&cloud.user().email)||''),{right:'<span class="tiny" style="color:var(--good);font-weight:800;">SYNCED</span>'})
          + setRow(icon('sync',18),'Sync now',{onclick:'syncNowUI()'})
          + setRow(icon('signout',18),'Sign out',{onclick:'signOutUI()',color:'var(--bad)'})
        : setRow(icon('cloud',19),'Create account / Sign in',{onclick:"openAccount('signup')"})}
      ${setRow(icon('user',18),'Edit profile',{onclick:'openEdit()'})}
      ${setRow(icon('barbell',19),'Units',{right:unitSeg})}
      <div class="setsec">Preferences</div>
      ${window.cloud&&cloud.ready()
        ? setRow(icon('bell',18),'Nudge notifications',{right:`<button class="chip ${pushOn?'on':''}" onclick="event.stopPropagation();togglePush()">${pushOn?'On 🔔':'Off'}</button>`})
        : setRow(icon('bell',18),'Notifications',{onclick:"toast('Sign in first — notifications are per account')"})}
      ${setRow('<span style="color:#ff5a6e;">'+icon('heart',18)+'</span>','Apple Health',{onclick:'comingSoon()'})}
      ${setRow('<span style="color:#fc4c02;">'+icon('bolt',18)+'</span>','Connect Strava',{onclick:'comingSoon()'})}
      ${setRow(icon('palette',18),'Theme',{onclick:'comingSoon()'})}
      <div class="setsec">Data & testing</div>
      ${setRow(icon('sparkle',18),'Preview ascension',{onclick:'closeSettings();previewAscension()'})}
      ${setRow('<span style="color:var(--warn);">'+icon('star',18)+'</span>','Pro mode (preview)',{right:proSeg})}
      ${setRow(icon('trash',18),'Reset all data',{onclick:"if(confirm('Erase all data?')){resetAll();closeSettings();}",color:'var(--bad)'})}
      <div class="setsec">Resources</div>
      ${setRow(icon('help',18),'Frequently asked questions',{onclick:'comingSoon()'})}
      ${setRow(icon('mail',18),'Contact us',{onclick:'comingSoon()'})}
      ${setRow(icon('globe',18),'Website',{onclick:'comingSoon()'})}
      ${setRow(icon('restore',18),'Restore purchases',{onclick:'comingSoon()'})}
      <div class="setsec">Legal</div>
      ${setRow(icon('doc',18),'Privacy policy',{onclick:'comingSoon()'})}
      ${setRow(icon('doc',18),'Terms of use',{onclick:'comingSoon()'})}
      <div class="tiny muted" style="text-align:center;margin-top:22px;">ASCEND prototype · v0.18 · ${window.cloud&&cloud.ready()?'synced to your account':'data stored on this device'}</div>
    </div>`;
}
// ---------- Account sheet (for users who skipped the onboarding account step) ----------
let acctMode='signup', acctBusy=false;
function openAccount(m){ acctMode=m||'signup'; renderAccountSheet(); openModal('accountModal'); }
function renderAccountSheet(){
  const signin=acctMode==='signin';
  document.getElementById('accountSheet').innerHTML=`<div class="grab"></div>
    <h2 style="margin:0 0 4px;display:flex;align-items:center;gap:8px;">${signin?'Sign in':'Create your account'} <span style="color:var(--accent2);">${icon('cloud',20)}</span></h2>
    <p class="sub" style="margin-bottom:14px;">${signin?'Your lifts, rank and streaks load onto this device.':'Your data follows you to any device — and you join the leaderboard when friends arrive.'}</p>
    ${signin?'':`<label class="f">Lifter name (public · 3–20 letters, numbers, _)</label>
    <input id="acUser" placeholder="e.g. ${escapeAttr((S.name||'lifter').replace(/[^A-Za-z0-9_]/g,'')||'lifter')}" style="margin-bottom:10px;">`}
    <label class="f">Email</label>
    <input id="acEmail" type="email" placeholder="you@email.com" style="margin-bottom:10px;">
    <label class="f">Password${signin?'':' (8+ characters)'}</label>
    <input id="acPass" type="password" placeholder="••••••••" style="margin-bottom:14px;">
    <button class="btn" onclick="acctSubmit()">${signin?'Sign in':'Create account'}</button>
    <div class="tiny muted" style="text-align:center;margin-top:10px;">${signin
      ?`New here? <b style="color:var(--accent2);cursor:pointer;" onclick="openAccount('signup')">Create an account</b>`
      :`Already have one? <b style="color:var(--accent2);cursor:pointer;" onclick="openAccount('signin')">Sign in</b>`}</div>
    <button class="btn ghost" style="margin-top:10px;" onclick="closeModal('accountModal')">Cancel</button>`;
}
async function acctSubmit(){
  if(acctBusy) return;
  const email=(document.getElementById('acEmail').value||'').trim(), pass=document.getElementById('acPass').value||'';
  if(!email||!pass){ toast(acctMode==='signin'?'Enter your email and password':'Fill in every field'); return; }
  acctBusy=true;
  try{
    if(acctMode==='signin'){
      await cloud.signIn(email, pass);
      S.onboarded=true; await cloud.pullAll();
      localStorage.setItem('ascend', JSON.stringify(S));
      applyTheme(); const cur=document.querySelector('.screen.active'); go(cur?cur.id.replace('screen-',''):'train');
      toast('Welcome back, '+S.name+' ☁️');
    } else {
      const uname=(document.getElementById('acUser').value||'').trim();
      if(!/^[A-Za-z0-9_]{3,20}$/.test(uname)){ toast('Lifter name: 3–20 letters, numbers or _'); acctBusy=false; return; }
      if(pass.length<8){ toast('Password needs 8+ characters'); acctBusy=false; return; }
      await cloud.signUp(email, pass, uname);
      S.profileUpdatedAt=Date.now(); localStorage.setItem('ascend', JSON.stringify(S));
      cloud.queueAllLocal();
      toast('Account created — this device now syncs ☁️');
    }
    closeModal('accountModal');
    if(document.getElementById('settingsScreen').classList.contains('show')) renderSettings();
  }catch(e){ toast(authErrMsg(e)); }
  finally{ acctBusy=false; }
}
async function syncNowUI(){
  const n=cloud.pending();
  await cloud.syncNow(); await cloud.pullAll();
  localStorage.setItem('ascend', JSON.stringify(S));
  renderSettings(); toast(n?('Synced '+n+' change'+(n>1?'s':'')+' ☁️'):'Up to date ☁️');
}
async function signOutUI(){
  await cloud.signOut(); renderSettings();
  toast('Signed out — your data stays on this device');
}
function renderLevelsCard(){
  const li=levelInfo(totalXP());
  const hex=`<svg width="58" height="64" viewBox="0 0 58 64" style="display:block;"><polygon points="29,2 55,17 55,47 29,62 3,47 3,17" fill="var(--card2)" stroke="var(--accent)" stroke-width="2.5"/></svg>`;
  document.getElementById('levelsBody').innerHTML=`
    <div class="row sb" style="margin-bottom:14px;"><h2 style="margin:0;">◆ Levels</h2></div>
    <div class="row" style="gap:14px;">
      <div style="position:relative;flex-shrink:0;">${hex}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:var(--accent2);">${li.level}</div></div>
      <div class="grow">
        <div class="row sb" style="margin-bottom:6px;"><div style="font-weight:700;">Level ${li.level}</div><div class="tiny muted">${li.into} / ${li.need} XP</div></div>
        <div class="xpbar" style="height:11px;"><div class="xpfill" style="width:${Math.round(li.pct*100)}%"></div></div>
        <div class="tiny muted" style="margin-top:7px;">${li.need-li.into} XP to Level ${li.level+1}</div>
      </div>
    </div>`;
}
function escapeAttr(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmtHeight(){
  if(!S.heightCm) return '—';
  if(S.heightUnit==='ft'){ const tot=S.heightCm/2.54, ft=Math.floor(tot/12), inch=Math.round(tot-ft*12); return ft+"'"+inch+'"'; }
  return Math.round(S.heightCm)+' cm';
}
// ----- Edit profile sheet -----
const GOALS=['Build muscle','Get stronger','Lose fat','Maintain','General fitness'];
let editGoalSel=null, editHUnit='cm';
function openEdit(){ editGoalSel=S.goal||null; editHUnit=S.heightUnit||'cm'; renderEditSheet(); openModal('editModal'); }
function setEditGoal(g){ editGoalSel=(editGoalSel===g?null:g); renderEditSheet(); }
function captureEditHeight(){
  if(editHUnit==='ft'){ const ft=+((document.getElementById('editFt')||{}).value)||0, inch=+((document.getElementById('editIn')||{}).value)||0; if(ft||inch) S.heightCm=ft*30.48+inch*2.54; }
  else { const cm=+((document.getElementById('editCm')||{}).value)||0; if(cm) S.heightCm=cm; }
}
function setEditHUnit(u){ captureEditHeight(); editHUnit=u; renderEditSheet(); }
function renderEditSheet(){
  let heightInputs;
  if(editHUnit==='ft'){ const tot=S.heightCm?S.heightCm/2.54:0, ft=tot?Math.floor(tot/12):'', inch=tot?Math.round(tot-Math.floor(tot/12)*12):'';
    heightInputs=`<div class="row" style="gap:10px;"><input id="editFt" type="number" inputmode="numeric" placeholder="ft" value="${ft}"><input id="editIn" type="number" inputmode="numeric" placeholder="in" value="${inch}"></div>`;
  } else heightInputs=`<input id="editCm" type="number" inputmode="numeric" placeholder="cm" value="${S.heightCm?Math.round(S.heightCm):''}">`;
  document.getElementById('editSheet').innerHTML=`<div class="grab"></div>
    <h2 style="margin:0 0 12px;">Edit profile</h2>
    <label class="f">Display name</label>
    <input id="editName" placeholder="Your name" value="${escapeAttr(S.name)}" style="margin-bottom:14px;">
    <label class="f">Units</label>
    <div class="seg" style="margin-bottom:14px;"><button id="uLb" class="${S.units==='lb'?'on':''}" onclick="setUnits('lb')">lb</button><button id="uKg" class="${S.units==='kg'?'on':''}" onclick="setUnits('kg')">kg</button></div>
    <label class="f">Bodyweight (${S.units})</label>
    <input id="editBW" type="number" inputmode="decimal" placeholder="${S.units==='kg'?'80':'180'}" value="${S.bw||''}" style="margin-bottom:14px;">
    <label class="f">Height</label>
    <div class="seg" style="margin-bottom:8px;"><button class="${editHUnit==='cm'?'on':''}" onclick="setEditHUnit('cm')">cm</button><button class="${editHUnit==='ft'?'on':''}" onclick="setEditHUnit('ft')">ft / in</button></div>
    ${heightInputs}
    <div class="row" style="gap:10px;margin:14px 0;">
      <div class="grow"><label class="f">Age</label><input id="editAge" type="number" inputmode="numeric" placeholder="years" value="${S.age||''}"></div>
      <div class="grow"><label class="f">Body fat % (optional)</label><input id="editBF" type="number" inputmode="decimal" placeholder="e.g. 15" value="${S.bodyFat||''}"></div>
    </div>
    <label class="f">Activity level</label>
    <select id="editActivity" style="margin-bottom:14px;">${Object.keys(ACTIVITY).map(k=>`<option value="${k}"${(S.activity||'moderate')===k?' selected':''}>${ACTIVITY[k].label} — ${ACTIVITY[k].desc}</option>`).join('')}</select>
    <label class="f">Fitness goal</label>
    <div class="chiprow" style="flex-wrap:wrap;">${GOALS.map(g=>`<div class="chip ${editGoalSel===g?'on':''}" onclick="setEditGoal('${g}')">${g}</div>`).join('')}</div>
    <label class="f" style="margin-top:14px;">Calorie target — leave blank for the AI plan</label>
    <input id="editCals" type="number" inputmode="numeric" placeholder="Auto (${nutritionPlan().kcal} kcal)" value="${S.calories||''}" style="margin-bottom:16px;">
    <button class="btn" onclick="saveProfile()">Save</button>
    <button class="btn ghost" onclick="closeModal('editModal')" style="margin-top:8px;">Cancel</button>`;
}
function saveProfile(){
  captureEditHeight();
  S.name=(document.getElementById('editName').value||'').trim()||'Athlete';
  S.bw=+document.getElementById('editBW').value||S.bw;
  S.heightUnit=editHUnit; S.goal=editGoalSel;
  S.age=+document.getElementById('editAge').value||null;
  S.bodyFat=+document.getElementById('editBF').value||null;
  S.activity=document.getElementById('editActivity').value||'moderate';
  const cals=+document.getElementById('editCals').value; S.calories=cals||null;
  save(); closeModal('editModal'); renderProfile(); renderTrain(); toast('Profile saved');
}
// Switch units AND convert all logged weights so the numbers stay meaningful.
// Scoring uses weight÷bodyweight ratios, so rank is unaffected by the switch.
function setUnits(u){
  if(u===S.units) return;
  const bwIn=document.getElementById('editBW'); if(bwIn && +bwIn.value) S.bw=+bwIn.value;
  const f = (S.units==='lb'&&u==='kg')?0.45359237:(S.units==='kg'&&u==='lb')?2.20462262:1;
  const round = v => Math.round(v*2)/2;
  if(f!==1){
    S.bw = round(S.bw*f);
    const conv = ses => ses.exercises.forEach(ex=>ex.sets.forEach(s=>{ if(s.weight) s.weight=round((+s.weight)*f); }));
    S.sessions.forEach(conv); if(S.active) conv(S.active);
  }
  S.units=u; save();
  if(document.getElementById('editModal').classList.contains('open')) renderEditSheet();
  if(document.getElementById('settingsScreen').classList.contains('show')) renderSettings();
  renderProfile(); renderTrain();
  toast('Switched to '+u+(f!==1?' · weights converted':''));
}
function resetAll(){ if(confirm('Erase all data?')){ S=fresh(); save(); go('train'); toast('Reset complete'); } }

