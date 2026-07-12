// ---------- RANK ----------
let rankSub='rank';
function setRankSub(s){ rankSub=s;
  document.getElementById('subRank').classList.toggle('on',s==='rank');
  document.getElementById('subBody').classList.toggle('on',s==='body');
  document.getElementById('subLeagues').classList.toggle('on',s==='leagues');
  renderRank();
}
function renderRank(){
  document.getElementById('rankOverview').style.display = rankSub==='rank'?'block':'none';
  document.getElementById('rankBodygraph').style.display = rankSub==='body'?'block':'none';
  document.getElementById('rankLeagues').style.display = rankSub==='leagues'?'block':'none';
  if(rankSub==='rank') renderOverview(); else if(rankSub==='body') renderBodygraph(); else renderBoard();
}
function renderOverview(){
  const sr=overallSR(), det=rankDetail(sr), r=det.rank, nx=nextRank(sr);
  document.getElementById('rankGlow').style.background=r.color;
  const pct = nx ? (sr-r.min)/(nx.min-r.min) : 1;
  const C=2*Math.PI*88;
  // Rank name auto-fits the ring: short names stay 20px, long ones (e.g. "Featherweight 3") scale down.
  const rankLabel = `${r.name}${det.division?' '+det.division:''}`;
  const rankFS = Math.max(14, Math.min(20, Math.floor(150/(rankLabel.length*0.62))));
  // total volume & PRs
  const totalVol=S.sessions.reduce((a,s)=>a+sessionVolume(s),0), best=bestLifts();
  const ratios=Object.entries(best).map(([id,b])=>b.w/S.bw), bestRatio=ratios.length?Math.max(...ratios):0;

  document.getElementById('rankOverview').innerHTML=`
    <div class="card" style="text-align:center; position:relative; overflow:hidden;">
      <div class="ringwrap">
        <svg class="ring" width="200" height="200" viewBox="0 0 200 200" style="filter:drop-shadow(0 0 7px ${r.color}59);">
          <circle cx="100" cy="100" r="88" stroke="#17171f" stroke-width="12" fill="none"/>
          <circle class="prog" cx="100" cy="100" r="88" stroke="${r.color}" stroke-width="12" fill="none" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C*(1-Math.max(0.02,Math.min(1,pct)))}"/>
        </svg>
        <div class="ringcenter">
          <div class="embFloat" style="filter:drop-shadow(0 0 18px ${r.color}66);">${rankEmblem(r,80,det.division)}</div>
          <div style="font-size:${rankFS}px;font-weight:800;margin-top:2px;color:${r.color};white-space:nowrap;">${rankLabel}</div>
          <div class="tiny muted">${det.ascended?det.sr+' SR':det.sr+' / 100 SR'}</div>
        </div>
      </div>
      <div style="margin-top:12px;" class="tiny muted">${nx?`<b style="color:${nx.color}">${det.toNext} SR</b> to <b>${nx.name}</b>`:`Peak rank — <b style="color:${r.color}">Ascended</b> ☀️`}</div>
    </div>

    <h2 style="margin-top:6px;">Rank over time</h2>
    <div class="card">${rankChart()}</div>

    <div class="statgrid">
      <div class="stat"><div class="v">${fmt(totalVol)}</div><div class="l">Total Volume</div></div>
      <div class="stat"><div class="v">${S.sessions.length}</div><div class="l">Sessions</div></div>
      <div class="stat"><div class="v">${bestRatio?bestRatio.toFixed(2)+'×':'—'}</div><div class="l">Best Lift Ratio</div></div>
      <div class="stat"><div class="v">${Object.keys(best).length}</div><div class="l">Lifts Ranked</div></div>
    </div>

    <h2>Your climb</h2>
    <div id="rankLadder"></div>`;
  renderLadder('rankLadder', 'solo', false);
}
function rankChart(){
  // SR after each session chronologically
  const ses=S.sessions.slice().sort((a,b)=>a.start-b.start);
  if(ses.length<2) return `<div class="empty">Log a few sessions to see your climb.</div>`;
  const pts=[]; for(let i=0;i<ses.length;i++) pts.push(overallSRfrom(ses.slice(0,i+1)));
  const W=300,H=120,pad=8, max=Math.max(...pts,10), min=0;
  const xs=i=>pad+i*(W-2*pad)/(pts.length-1), ys=v=>H-pad-(v-min)/(max-min)*(H-2*pad);
  const line=pts.map((v,i)=>`${i?'L':'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const area=`M${xs(0)} ${H-pad} `+pts.map((v,i)=>`L${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ')+` L${xs(pts.length-1)} ${H-pad} Z`;
  const last=rankFor(pts[pts.length-1]).color;
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;">
    <defs><linearGradient id="ac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${last}" stop-opacity=".35"/><stop offset="1" stop-color="${last}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#ac)"/><path d="${line}" fill="none" stroke="${last}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((v,i)=>`<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="2.5" fill="${last}"/>`).join('')}
  </svg><div class="tiny muted" style="text-align:center;margin-top:6px;">SR across ${pts.length} sessions</div>`;
}

// ---------- Bodygraph ----------
let openGroups={};
function gColor(g){ const s=groupSR(g); return s==null?'#17171f':rankFor(s).color; }
// Map the anatomical template's muscle slugs onto our 6 training groups.
// Several template muscles roll up to one group (e.g. all delts -> Shoulders).
const SLUG2GRP={chest:'Chest', obliques:'Core', abs:'Core', biceps:'Arms', triceps:'Arms',
  deltoids:'Shoulders', trapezius:'Back', forearm:'Arms', quadriceps:'Legs', adductors:'Legs',
  calves:'Legs', tibialis:'Legs', hamstring:'Legs', gluteal:'Legs', 'upper-back':'Back', 'lower-back':'Back'};
let bodyColorMode='rank';
function setBodyColor(m){ bodyColorMode=m; renderBodygraph(); }
function bodySVG(side, colorFn, maxW){
  const A=window.ANATOMY; if(!A) return '<div class="empty">anatomy unavailable</div>';
  colorFn = colorFn || (g=> g?gColor(g):'#1b1b26');
  let m='';
  A[side].forEach(p=>{
    const grp=SLUG2GRP[p.slug];
    const fill = grp ? colorFn(grp) : '#1b1b26';        // cosmetic parts blend into silhouette
    const ds=[].concat(p.path.left||[], p.path.right||[], p.path.common||[]);
    ds.forEach(d=>{ m+=`<path d="${d}" fill="${fill}" stroke="#0a0a0f" stroke-width="2.5" stroke-opacity="0.22"/>`; });
  });
  return `<svg viewBox="${A.viewBox[side]}" width="100%" style="max-width:${maxW||150}px;display:block;">`
    +`<path d="${A.outline[side]}" fill="#1b1b26" stroke="#33334a" stroke-width="2.5"/>${m}</svg>`;
}
// ----- Muscle activation (volume) model -----
// Primary group = EXMAP[id].group (full weight). Secondary contributions below let
// COMPOUND lifts light up several groups; ISOLATION lifts light only their primary.
const ACT_SEC={
  bench:{Arms:0.4,Shoulders:0.3}, inclineBb:{Arms:0.35,Shoulders:0.4}, declineBb:{Arms:0.4,Shoulders:0.2},
  benchDb:{Arms:0.35,Shoulders:0.3}, inclineDb:{Arms:0.3,Shoulders:0.35}, chestPress:{Arms:0.35,Shoulders:0.25},
  dip:{Arms:0.5,Shoulders:0.2}, pushup:{Arms:0.35,Shoulders:0.25,Core:0.2},
  dead:{Legs:0.6,Core:0.4}, sumo:{Legs:0.6,Core:0.35}, rackpull:{Legs:0.3,Core:0.3},
  rowBb:{Arms:0.4,Core:0.2}, pendlay:{Arms:0.4,Core:0.2}, rowDb:{Arms:0.4}, tbar:{Arms:0.4}, cablerow:{Arms:0.35},
  latpull:{Arms:0.35}, pullup:{Arms:0.45,Core:0.2}, chinup:{Arms:0.5}, uprightrow:{Arms:0.3,Back:0.2},
  ohp:{Arms:0.4,Core:0.2}, pressDb:{Arms:0.35}, arnold:{Arms:0.3},
  squat:{Core:0.4,Back:0.2}, front:{Core:0.45,Back:0.2}, hack:{Core:0.2}, rdl:{Back:0.4,Core:0.3},
  goblet:{Core:0.3}, bulgarian:{Core:0.25}, lunge:{Core:0.2}, hip:{Core:0.2}, legpress:{Core:0.1},
  cgbench:{Chest:0.4,Shoulders:0.2}, abwheel:{Arms:0.1},
  // Added compounds — secondary groups so they light more than their primary on the bodygraph.
  smithBench:{Arms:0.4,Shoulders:0.3}, inclinePress:{Arms:0.3,Shoulders:0.35}, crossover:{Shoulders:0.2},
  trapDead:{Legs:0.6,Core:0.4}, deficitDead:{Legs:0.6,Core:0.4}, goodmorning:{Legs:0.5,Core:0.4},
  chestRow:{Arms:0.4}, machineRow:{Arms:0.4}, meadows:{Arms:0.4}, invertedRow:{Arms:0.4,Core:0.2},
  widePulldown:{Arms:0.35}, neutralPulldown:{Arms:0.35}, pullover:{Chest:0.3},
  pushpress:{Arms:0.4,Legs:0.3,Core:0.3}, seatedOhp:{Arms:0.4,Core:0.2}, machineShoulder:{Arms:0.35}, landmine:{Chest:0.3,Arms:0.3,Core:0.2},
  smithSquat:{Core:0.4,Back:0.2}, boxsquat:{Core:0.4,Back:0.2}, beltsquat:{Core:0.3}, stiffleg:{Back:0.4,Core:0.3},
  stepup:{Core:0.2}, pistol:{Core:0.3}, benchdip:{Chest:0.3,Shoulders:0.2}, woodchopper:{Arms:0.1}
};
function activationForSession(ses){
  const act={}; GROUPS.forEach(g=>act[g]=0);
  ses.exercises.forEach(ex=>{
    const sets=ex.sets.length, primary=EXMAP[ex.id].group;
    act[primary]+=sets; const sec=ACT_SEC[ex.id]||{};
    for(const g in sec) act[g]+=sets*sec[g];
  });
  return act;
}
function activationAllTime(){ const act={}; GROUPS.forEach(g=>act[g]=0);
  S.sessions.forEach(s=>{ const a=activationForSession(s); GROUPS.forEach(g=>act[g]+=a[g]); }); return act; }
const VOL_COLOR='#ff6a2c';  // single heat color: faint = light volume, vivid = heavy
function hex2rgb(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function mixc(a,b,t){ const A=hex2rgb(a),B=hex2rgb(b); return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')+')'; }
// returns g => one-color shade: faint for light volume, vivid for heavy (unworked = neutral)
function actColorFn(actMap){
  const max=Math.max(1,...GROUPS.map(g=>actMap[g]||0));
  return g=>{ const v=actMap[g]||0; if(v<=0) return '#1b1b26'; const t=Math.min(1,v/max); return mixc('#17171f', VOL_COLOR, 0.18+0.82*t); };
}
// ---------- Strength progress (per muscle group, over time) ----------
let progGroup='Overall';
function setProgGroup(g){ progGroup=g; renderBodygraph(); }
// SR for the chosen group after each chronological session (cumulative bests). Skips sessions
// before the group was first trained, so the line starts when the data does.
function groupSRSeries(group){
  const ses=S.sessions.slice().sort((a,b)=>a.start-b.start), out=[];
  for(let i=0;i<ses.length;i++){
    const sub=ses.slice(0,i+1);
    const v = group==='Overall' ? overallSRfrom(sub) : groupSRfrom(bestLiftsFrom(sub), group);
    if(v!=null) out.push(v);
  }
  return out;
}
function srLineSVG(pts, color, id){
  const W=300,H=132,pad=10;
  let mn=Math.min(...pts), mx=Math.max(...pts);
  if(mx-mn<10){ const mid=(mx+mn)/2; mn=Math.max(0,mid-10); mx=mid+10; } else { mn=Math.max(0,mn-6); mx=mx+6; }
  const xs=i=>pad+i*(W-2*pad)/(pts.length-1), ys=v=>H-pad-(v-mn)/(mx-mn)*(H-2*pad);
  const line=pts.map((v,i)=>`${i?'L':'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const area=`M${xs(0)} ${H-pad} `+pts.map((v,i)=>`L${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ')+` L${xs(pts.length-1)} ${H-pad} Z`;
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".34"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((v,i)=>`<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="2.3" fill="${color}"/>`).join('')}
  </svg>`;
}
function renderStrengthProgress(){
  const groups=['Overall'].concat(GROUPS);
  const chips=groups.map(g=>`<div class="chip ${progGroup===g?'on':''}" onclick="setProgGroup('${g}')">${g}</div>`).join('');
  const pts=groupSRSeries(progGroup);
  let body;
  if(pts.length<2){
    body=`<div class="empty" style="padding:20px 10px;">${progGroup==='Overall'?'Log a couple of sessions':'Train '+progGroup.toLowerCase()+' across a couple of sessions'} to chart your strength climb.</div>`;
  } else {
    const cur=pts[pts.length-1], delta=Math.round(cur-pts[0]), rk=rankFor(cur), col=rk.color;
    body=`<div class="row sb" style="margin-bottom:8px;">
        <div><div style="font-weight:900;font-size:22px;color:${col};line-height:1;">${Math.round(cur)} <span class="tiny muted" style="font-weight:700;">SR</span></div>
          <div class="tiny" style="color:${col};font-weight:700;margin-top:3px;">${rk.name}</div></div>
        <div style="text-align:right;"><div style="font-weight:800;font-size:15px;color:${delta>=0?'var(--good)':'var(--bad)'};">${delta>=0?'+':''}${delta} SR</div>
          <div class="tiny muted">across ${pts.length} sessions</div></div>
      </div>${srLineSVG(pts, col, 'sgrad_'+progGroup)}`;
  }
  return `<div class="card">
    <div class="row sb" style="margin-bottom:10px;"><div style="font-weight:800;">${icon('chart',18)} Strength progress</div></div>
    <div class="chiprow" style="margin-bottom:12px;">${chips}</div>
    ${body}</div>`;
}
function renderBodygraph(){
  const volMode = bodyColorMode==='volume';
  const colorFn = volMode ? actColorFn(activationAllTime()) : (g=>gColor(g));
  const front=bodySVG('front',colorFn), back=bodySVG('back',colorFn);
  const legend = volMode
    ? `<div class="tiny muted" style="margin-top:8px;">Shade shows how much you trained each muscle.
        <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-top:7px;">
          <span>Less</span><span style="width:130px;height:9px;border-radius:999px;background:linear-gradient(90deg,#17171f,${VOL_COLOR});"></span><span>More</span>
        </div></div>`
    : `<div class="tiny" style="color:var(--mut2);margin-top:8px;">Color shows your rank in each muscle group.</div>`;
  let html=`<div class="card" style="text-align:center;">
    <div class="chiprow" style="justify-content:center;margin-bottom:10px;">
      <div class="chip ${volMode?'':'on'}" onclick="setBodyColor('rank')">🛡️ By Rank</div>
      <div class="chip ${volMode?'on':''}" onclick="setBodyColor('volume')">${flameSVG(14)} By Volume</div>
    </div>
    <div style="display:flex;justify-content:center;gap:10px;align-items:flex-start;">${front}${back}</div>
    <div style="display:flex;margin-top:2px;"><div class="tiny muted" style="flex:1;">Front</div><div class="tiny muted" style="flex:1;">Back</div></div>
    ${legend}
    <div class="tiny" style="color:var(--mut2);margin-top:6px;">Anatomy: react-native-body-highlighter · MIT</div>
  </div>
  ${renderStrengthProgress()}
  <h2>Muscle rankings</h2>`;
  GROUPS.forEach(g=>{
    const s=groupSR(g); const rk=s==null?null:rankFor(s); const open=!!openGroups[g];
    const best=bestLifts();
    const lifts=Object.entries(best).filter(([id])=>EXMAP[id].group===g)
      .map(([id,b])=>({ex:EXMAP[id],sc:liftScore(id,b.w),w:b.w})).sort((a,b)=>b.sc-a.sc);
    html+=`<div class="card" style="padding:0;overflow:hidden;">
      <div class="row sb" style="padding:14px 16px;" onclick="toggleGroup('${g}')">
        <div class="row" style="gap:12px;">${rk?`<div>${rankEmblem(rk,30)}</div>`:`<div class="liftmark">—</div>`}
          <div><div style="font-weight:700;">${g}</div><div class="tiny" style="color:${rk?rk.color:'var(--mut2)'};font-weight:600;">${rk?rk.name:'No data'}</div></div></div>
        <div class="muted">${open?'▲':'▼'}</div>
      </div>`;
    if(open){
      html+=`<div style="padding:0 16px 8px;">`;
      if(!lifts.length) html+=`<div class="empty" style="padding:14px;">Log a ${g.toLowerCase()} lift to rank it.</div>`;
      else lifts.forEach(l=>{ const lr=rankFor(liftSR(l.sc));
        html+=`<div class="lift"><div class="liftmark">${l.ex.icon}</div>
          <div class="grow"><div class="row sb"><div style="font-weight:700;">${l.ex.name}</div><div class="tiny" style="color:${lr.color};font-weight:700;">${lr.name}</div></div>
            <div class="barbg" style="margin:7px 0 4px;"><div class="barfill" style="width:${Math.min(100,l.sc)}%;background:${lr.color};"></div></div>
            <div class="tiny muted">${fmt(Math.round(l.w))} ${S.units} · ${(l.w/S.bw).toFixed(2)}× bw</div></div></div>`;
      });
      html+=`</div>`;
    }
    html+=`</div>`;
  });
  document.getElementById('rankBodygraph').innerHTML=html;
}
function toggleGroup(g){ openGroups[g]=!openGroups[g]; renderBodygraph(); }

// ---------- LEADERBOARD (cloud-backed) ----------
// Global = every ASCEND account ordered by cached SR; Friends = accepted friends + you.
let scope='global', lbCache=null, lbAt=0, lbLoading=false;
function setScope(el,s){ document.querySelectorAll('#boardScope .chip').forEach(c=>c.classList.remove('on')); el.classList.add('on'); scope=s; renderBoard(); }
async function refreshBoard(){
  if(!(window.cloud&&cloud.ready())||lbLoading) return;
  lbLoading=true;
  try{ lbCache=await cloud.getLeaderboard(); lbAt=Date.now(); fromRefreshGuard=true;
    if(rankSub==='leagues') renderBoard(true);   // personal ladder (Rank tab) needs no leaderboard data
    fromRefreshGuard=false; }catch(e){}
  lbLoading=false;
}
function renderBoard(fromRefresh){
  const mySR=overallSR(), signedIn=window.cloud&&cloud.ready();
  let pool;
  if(signedIn&&lbCache){
    const uid=cloud.user().id;
    if(scope==='friends'){
      pool=FR.friends.map(f=>({n:(f.other&&f.other.username)||'?', sr:(f.other&&f.other.sr)||0, me:false}));
      pool.push({n:S.name||'You', sr:mySR, me:true});
    } else {
      pool=lbCache.map(p=>({n:p.username, sr:p.id===uid?mySR:(p.sr||0), me:p.id===uid}));
      if(!pool.some(p=>p.me)) pool.push({n:S.name||'You', sr:mySR, me:true});
    }
  } else pool=[{n:S.name||'You', sr:mySR, me:true}];
  pool.sort((a,b)=>b.sr-a.sr);
  if(!fromRefresh && signedIn && (!lbCache || Date.now()-lbAt>30000)) refreshBoard();
  document.getElementById('board').innerHTML=pool.map((p,i)=>{
    const det=rankDetail(p.sr), r=det.rank, medal=medalSVG(i,26), initials=p.n.slice(0,2).toUpperCase();
    return `<div class="lbrow ${p.me?'me':''}"><div class="lbrank">${medal}</div>
      <div class="avatar" style="background:${r.color};">${initials}</div>
      <div class="grow"><div style="font-weight:700;">${p.n} ${p.me?'<span class="tiny" style="color:var(--accent2)">· you</span>':''}</div>
        <div class="tiny" style="color:${r.color};font-weight:600;display:flex;align-items:center;gap:4px;">${rankEmblem(r,14)} ${r.name}${det.division?' '+det.division:''}</div></div>
      <div style="text-align:right;"><div style="font-weight:800;">${det.sr}</div><div class="tiny muted">SR</div></div></div>`;
  }).join('')
  + (pool.length===1?emptyState('users', scope==='friends'?'No friends on the board yet':'Just you out here',
      scope==='friends'?'Add friends in the Social tab — accepted friends appear here automatically.':'Get your friends on ASCEND — everyone with an account shows up here, ranked by SR.'):'');
}
// Perspective rank ladder — every tier/division stacked, your spot lit up, friends placed where they sit.
function divRoman(d){ return d?(['','I','II','III'][d]||''):''; }
function renderLadder(containerId, scp, autoScroll){
  containerId = containerId || 'rankLadder'; scp = scp || 'friends';
  const el = document.getElementById(containerId); if(!el) return;
  const mySR=overallSR(), myDet=rankDetail(mySR), myTier=RANKS.indexOf(myDet.rank), myDiv=myDet.division, signedIn=window.cloud&&cloud.ready();
  let others=[];
  if(scp!=='solo'){                       // 'solo' = personal climb (Rank tab): only you, never other lifters
    if(!fromRefreshGuard && signedIn && (!lbCache || Date.now()-lbAt>30000)) refreshBoard();
    if(signedIn){
      if(scp==='friends') others=FR.friends.map(f=>f.other).filter(Boolean).map(u=>({n:u.username, sr:u.sr||0}));
      else others=(lbCache||[]).filter(u=>u.id!==cloud.user().id).map(u=>({n:u.username, sr:u.sr||0}));
    }
  }
  const rungs=[]; for(let t=ASC;t>=0;t--){ if(t===ASC) rungs.push({t,d:null}); else for(let d=3;d>=1;d--) rungs.push({t,d}); }
  const body=rungs.map(rg=>{
    const rk=RANKS[rg.t], isMe=(rg.t===myTier && (rg.t===ASC || rg.d===myDiv));
    const here=others.filter(u=>{ const od=rankDetail(u.sr); return RANKS.indexOf(od.rank)===rg.t && (rg.t===ASC || od.division===rg.d); });
    const av = (isMe?`<div class="lav me" style="background:${rk.color};">${(S.name||'Y').slice(0,2).toUpperCase()}</div>`:'')
      + here.slice(0,3).map(u=>`<div class="lav" style="background:${rankFor(u.sr).color};">${u.n.slice(0,2).toUpperCase()}</div>`).join('')
      + (here.length>3?`<span class="tiny muted">+${here.length-3}</span>`:'');
    return `<div class="rung ${isMe?'me':'ladderDim'}" ${isMe?'id="myRung"':''}>
      <div class="rn" style="color:${rk.color};">${rk.name}<span style="opacity:.65;"> ${divRoman(rg.d)}</span></div>
      <div class="emb">${rankEmblem(rk, isMe?84:74, rg.d)}</div>
      <div class="lright">${isMe?'<span class="tiny" style="color:var(--accent2);font-weight:900;letter-spacing:.5px;">YOU</span>':''}${av}</div>
    </div>`;
  }).join('');
  const bc=myDet.rank.color;   // climber's own rank colour — NOT Ascended's
  el.innerHTML=`<div class="ladderWrap"><div class="ladderBeam" style="background:linear-gradient(180deg, transparent 0%, ${bc}30 3%, ${bc}22 12%, ${bc}15 38%, ${bc}0a 72%, transparent 100%);"></div>${body}</div>`;
  if(autoScroll) setTimeout(()=>{ const m=document.getElementById('myRung'); if(m) m.scrollIntoView({block:'center',behavior:'auto'}); },70);
}
let fromRefreshGuard=false;

