// ---------- boot ----------
hydrateIcons();
applyTheme();
if(!S.onboarded && !S.sessions.length) startOnboarding();
renderTrain();
// Cloud: restore session, pull account data, then refresh whatever's on screen.
window.S = S;
if(window.cloud && cloud.configured) cloud.init().then(u=>{
  if(!u) return;
  cloud.onSocial(ev=>{
    if(ev.type==='nudge'){ haptic([0,20,30,20]); toast('👋 A friend nudged you — check Friends'); refreshSocial(); }
    else if(ev.type==='friend'){ if(ev.row && ev.row.status==='pending' && ev.row.requested_by!==cloud.user().id){ haptic([0,20]); toast('New friend request 👥'); } refreshSocial(); }
    else if(ev.type==='post'||ev.type==='like'){ if(document.getElementById('screen-feed').classList.contains('active')) refreshFeed(); }
    else if(ev.type==='duel'){ const d=ev.row; const done=d&&d.status==='done';
      if(done){ cloud.pullAll().then(()=>{ localStorage.setItem('ascend',JSON.stringify(S)); refreshDuels(); }); }
      else refreshDuels();
      if(d&&d.status==='pending'&&d.opponent===cloud.user().id){ haptic([0,30]); toast('⚔️ A friend challenged you'); } }
    else if(ev.type==='message'){ onChatMessage(ev.row); }
  });
  cloud.pullAll().then(()=>{ localStorage.setItem('ascend', JSON.stringify(S)); applyTheme();
    const cur=document.querySelector('.screen.active'); go(cur?cur.id.replace('screen-',''):'train');
    refreshSocial();
  }).catch(()=>{});
  cloud.syncNow();
});
// Swipe-down to dismiss any bottom sheet (drag from the top, or anywhere when the sheet is scrolled to top)
document.querySelectorAll('.modal').forEach(mod=>{
  const sheet=mod.querySelector('.sheet'); if(!sheet) return;
  let y0=null, dy=0;
  sheet.addEventListener('touchstart',e=>{ y0 = sheet.scrollTop<=2 ? e.touches[0].clientY : null; dy=0; },{passive:true});
  sheet.addEventListener('touchmove',e=>{
    if(y0===null) return;
    dy=e.touches[0].clientY-y0;
    if(dy>0){ sheet.style.transition='none'; sheet.style.transform='translateY('+dy+'px)'; }
  },{passive:true});
  sheet.addEventListener('touchend',()=>{
    if(y0===null) return;
    if(dy>110){
      sheet.style.transition='transform .22s ease'; sheet.style.transform='translateY(105%)';
      setTimeout(()=>{ closeModal(mod.id); sheet.style.transform=''; sheet.style.transition=''; },210);
      haptic(12);
    } else { sheet.style.transition='transform .2s ease'; sheet.style.transform=''; setTimeout(()=>sheet.style.transition='',220); }
    y0=null; dy=0;
  });
});
// PWA: offline cache. On the DEV server (localhost) we do NOT register a worker and
// actively unregister any existing one + wipe its caches — a stale worker left over from
// a previous version otherwise serves an outdated shell (e.g. unstyled after a refactor).
// Production (HTTPS) registers as normal so the installed app still works offline.
if('serviceWorker' in navigator){
  const isDev=['localhost','127.0.0.1'].includes(location.hostname);
  if(isDev){
    navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
    if(window.caches) caches.keys().then(ks=>ks.forEach(k=>caches.delete(k))).catch(()=>{});
  } else if(location.protocol==='https:'){
    const hadController=!!navigator.serviceWorker.controller;   // true ⇒ this is an update, not a first install
    navigator.serviceWorker.register('sw.js').then(reg=>{
      setInterval(()=>reg.update().catch(()=>{}), 60*60*1000);  // check for a new version hourly
      reg.addEventListener('updatefound',()=>{ const nw=reg.installing; if(!nw) return;
        nw.addEventListener('statechange',()=>{ if(nw.state==='activated' && hadController) showUpdateBar(); }); });
    }).catch(()=>{});
  }
}
// Non-disruptive "a new version is ready" prompt — never auto-reloads mid-session.
function showUpdateBar(){
  if(document.getElementById('updBar')) return;
  const b=document.createElement('div'); b.id='updBar';
  b.style.cssText='position:fixed;left:50%;bottom:calc(108px + var(--safe-bottom,0px));transform:translateX(-50%);z-index:260;background:var(--accent);color:#fff;font-weight:800;font-size:14px;padding:11px 18px;border-radius:14px;box-shadow:0 10px 30px -10px #000;cursor:pointer;white-space:nowrap;';
  b.innerHTML='ASCEND updated — tap to refresh';
  b.onclick=()=>{ try{ if(window.cloud&&cloud.ready()) cloud.syncNow(); }catch(e){} location.reload(); };
  document.body.appendChild(b);
}
