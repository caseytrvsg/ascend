// ---------- helpers ----------
function fmt(n){ n=Math.round(n); return n>=1000?(n/1000).toFixed(n>=10000?0:1)+'k':''+n; }
function fmtClock(ms){ const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60), ss=s%60; return (h?h+':':'')+(h?String(m).padStart(2,'0'):m)+':'+String(ss).padStart(2,'0'); }
// Base 130 keeps modals ABOVE the full-screen overlays (Settings/Analysis/Streaks/Store/Chat are z-120),
// so a sheet opened from inside Settings (e.g. Edit profile) shows immediately instead of waiting for
// Settings to close. Each later modal stacks above earlier ones (e.g. exercise picker over routine builder).
let modalZ=130;
function openModal(id){ const m=document.getElementById(id); m.style.zIndex=++modalZ; m.classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); if(id==='scanModal'&&window.Scanner) Scanner.stop(); if(!document.querySelector('.modal.open')) modalZ=130; }
let toastT; function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200); }
['exModal','addExModal','routineModal','genModal','composeModal','memoryModal','allMemModal','editModal','finishModal','scanModal','friendsModal','proModal','accountModal'].forEach(id=>document.getElementById(id).addEventListener('click',e=>{ if(e.target.id===id) closeModal(id); }));

// ---------- Haptics ----------
// Web Vibration API (works on Android/Chrome). iOS Safari ignores it — the real
// React Native build will use the iOS Taptic Engine (Expo Haptics) for true haptics.
function haptic(p){ try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }
document.addEventListener('click',e=>{ if(e.target.closest('button')) haptic(12); }, true);

// ---------- Rank-up celebration ----------
function rankOrdinal(det){ return RANKS.indexOf(det.rank)*3 + (det.division? (det.division-1) : 3); }
function celebrateRankUp(oldDet,newDet){
  const r=newDet.rank, c=r.color, tierUp=RANKS.indexOf(newDet.rank)>RANKS.indexOf(oldDet.rank);
  let rays=''; for(let i=0;i<24;i++){ const a0=i*15*Math.PI/180, a1=(i*15+3.4)*Math.PI/180;
    rays+=`<polygon points="100,100 ${(100+Math.cos(a0)*120).toFixed(1)},${(100+Math.sin(a0)*120).toFixed(1)} ${(100+Math.cos(a1)*120).toFixed(1)},${(100+Math.sin(a1)*120).toFixed(1)}" fill="${c}" opacity="${i%2?0.45:0.9}"/>`; }
  document.getElementById('celRays').innerHTML=`<svg viewBox="0 0 200 200" style="overflow:visible">${rays}</svg>`;
  document.getElementById('celGlow').style.background=c;
  document.getElementById('celEmblem').innerHTML=rankEmblem(r,150,newDet.division);
  document.getElementById('celKicker').textContent=tierUp?'NEW TIER UNLOCKED':'RANK UP';
  document.getElementById('celRank').textContent=`${r.name}${newDet.division?' '+newDet.division:''}`;
  document.getElementById('celRank').style.color=c;
  document.getElementById('celLp').textContent=`${newDet.ascended?newDet.sr+' SR':newDet.sr+' / 100 SR'}`;
  document.getElementById('celSub').innerHTML=tierUp
    ? `You ascended from <b>${oldDet.rank.name}</b> to <b style="color:${c}">${r.name}</b>.`
    : `Promoted to <b style="color:${c}">${r.name} ${newDet.division||''}</b>. Keep climbing.`;
  document.getElementById('celebrate').classList.add('show');
  ['celGlow','celRays','celKicker','celEmblem','celRank','celLp','celSub','celBtn'].forEach(id=>{ const e=document.getElementById(id); e.classList.remove('go'); void e.offsetWidth; });
  requestAnimationFrame(()=>{ document.getElementById('celGlow').classList.add('go'); document.getElementById('celRays').classList.add('go'); });
  setTimeout(()=>document.getElementById('celKicker').classList.add('go'),150);
  setTimeout(()=>{ document.getElementById('celEmblem').classList.add('go'); burstParticles(c); haptic([0,55,60,40,70,140]); },350);
  setTimeout(()=>document.getElementById('celRank').classList.add('go'),720);
  setTimeout(()=>document.getElementById('celLp').classList.add('go'),850);
  setTimeout(()=>document.getElementById('celSub').classList.add('go'),1000);
  setTimeout(()=>document.getElementById('celBtn').classList.add('go'),1300);
}
function burstParticles(c){
  const wrap=document.getElementById('celParticles'); wrap.innerHTML='';
  for(let i=0;i<30;i++){
    const p=document.createElement('div'); p.className='cel-particle'; p.style.background=i%3?c:'#ffffff'; wrap.appendChild(p);
    const ang=Math.random()*Math.PI*2, dist=120+Math.random()*240, dur=900+Math.random()*800;
    p.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},
      {transform:`translate(${(Math.cos(ang)*dist).toFixed(0)}px,${(Math.sin(ang)*dist).toFixed(0)}px) scale(.3)`,opacity:0}],
      {duration:dur,delay:Math.random()*150,easing:'cubic-bezier(.15,.7,.3,1)',fill:'forwards'});
  }
}
let celReturn='rank';
function closeCelebrate(){ haptic(20); document.getElementById('celebrate').classList.remove('show'); go(celReturn); celReturn='rank'; }
function previewAscension(){ const cur=rankDetail(overallSR()); const ni=Math.min(ASC,RANKS.indexOf(cur.rank)+1); celebrateRankUp(cur, rankDetail(ni*100+8)); }

