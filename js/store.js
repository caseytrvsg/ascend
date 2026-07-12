// ---------- Store ----------
const ROLL_COST=10, OFFERS=[25,33,50];
const PACK_PRICE={pk1:'$0.99',pk2:'$3.99',pk3:'$9.99',pk4:'$24.99'};
const SHADES={
  common:    {bd:'#3a3a48', nm:'#eef0f5', tg:'#8a8a98'},
  consumable:{bd:'#5666d6', nm:'#dfe3ff', tg:'#97a3ff'},
  seasonal:  {bd:'#b9863f', nm:'#f0d8a8', tg:'#caa15a'},
  special:   {bd:'#3fae9a', nm:'#bdf0e6', tg:'#5bd6c0'},
  prismatic: {bd:'#8a6cff', nm:'#d8ccff', tg:'#a78bff'},
  elemental: {bd:'#3f7fd6', nm:'#cfe2ff', tg:'#6fa8ff'},
  cosmic:    {bd:'#d69a3f', nm:'#ffe6b0', tg:'#ffc24d'},
};
const STORE_SECTIONS=[
  {key:'consumables', title:'XP & Streak Boosts', layout:'shelf', items:[
    {id:'xp2',   name:'Double-XP Shake', tag:'Consumable', tier:'consumable', price:40,  kind:'consumable', desc:'Earn 2× XP from your next logged workout.'},
    {id:'xp3',   name:'Triple-XP Shake', tag:'Consumable', tier:'cosmic',     price:100, kind:'consumable', desc:'Earn 3× XP from your next logged workout.'},
    {id:'freeze',name:'Streak Freeze',   tag:'Consumable', tier:'special',    price:120, kind:'consumable', desc:'Protect your streak through one missed day.'},
    {id:'rest30',name:'Streak Restore',  tag:'Consumable', tier:'elemental',  price:250, kind:'consumable', desc:'Bring back a broken streak (up to 30 days).'},
    {id:'rest60',name:'Mega Restore',    tag:'Consumable', tier:'cosmic',     price:600, kind:'consumable', desc:'Bring back a broken streak (up to 60 days).'},
    {id:'phoenix',name:'Phoenix',        tag:'Consumable', tier:'prismatic',  price:1000,kind:'consumable', desc:'Rise from the ashes — revives your entire streak, no matter how long it was.'},
  ]},
  {key:'themes', title:'App Themes', layout:'shelf', items:[
    {id:'th_mid',   name:'Midnight',       tag:'Theme', tier:'special',   price:0,   kind:'theme', accent:'#9d5cff', accent2:'#c3a3ff', desc:'The classic ASCEND violet.'},
    {id:'th_ember', name:'Ember',          tag:'Theme', tier:'cosmic',    price:200, kind:'theme', accent:'#ff6a3c', accent2:'#ffac7a', desc:'Molten orange energy.'},
    {id:'th_jade',  name:'Jade',           tag:'Theme', tier:'special',   price:200, kind:'theme', accent:'#1fc98c', accent2:'#74efc4', desc:'Cool emerald focus.'},
    {id:'th_arctic',name:'Arctic',         tag:'Theme', tier:'elemental', price:200, kind:'theme', accent:'#2f9fef', accent2:'#86d4ff', desc:'Icy blue clarity.'},
    {id:'th_rose',  name:'Rosé',           tag:'Theme', tier:'prismatic', price:250, kind:'theme', accent:'#ff5c8a', accent2:'#ffa3c0', desc:'Bold pink burn.'},
    {id:'th_gold',  name:'Champion Gold',  tag:'Theme', tier:'cosmic',    price:500, kind:'theme', accent:'#f5b942', accent2:'#ffe1a0', desc:'Earned by the relentless.'},
  ]},
  {key:'borders', title:'Profile Borders', layout:'shelf', items:[
    {id:'bd_none',     name:'None',           tag:'Default',  tier:'common',    price:0,    kind:'border', ring:'',                                  desc:'No border.'},
    {id:'bd_water',    name:'Water',          tag:'Elemental',tier:'elemental', price:250, kind:'border', ring:'0 0 0 3px #2b6fff, 0 0 14px #4ea3ff', desc:'Flowing water ring.'},
    {id:'bd_fire',     name:'Fire',           tag:'Elemental',tier:'cosmic',    price:300, kind:'border', ring:'0 0 0 3px #ff6a2c, 0 0 16px #ff8a3c', desc:'Blazing fire ring.'},
    {id:'bd_sapphire', name:'Sapphire Shine', tag:'Level',    tier:'elemental', price:350, kind:'border', ring:'0 0 0 3px #3f6fff, 0 0 16px #6f9bff', desc:'Deep sapphire glow.'},
    {id:'bd_solaris',  name:'Solaris',        tag:'Cosmic',   tier:'cosmic',    price:450, kind:'border', ring:'0 0 0 3px #ffb84d, 0 0 20px #ffd27a', desc:'Radiant solar flare.'},
    {id:'bd_starshine',name:'Star Shine',     tag:'Cosmic',   tier:'cosmic',    price:500, kind:'border', ring:'0 0 0 3px #ffe08a, 0 0 22px #fff1c0', desc:'Shimmering starlight.'},
  ]},
  {key:'banners', title:'Profile Banners', layout:'shelf', items:[
    {id:'bn_none',  name:'None',           tag:'Default', tier:'common',    price:0,   kind:'banner', bg:'',                                     desc:'No banner.'},
    {id:'bn_winter',name:'Winter Serenity',tag:'Banner',  tier:'elemental', price:250, kind:'banner', bg:'linear-gradient(160deg,#1b2a4a,#0c0c12)', desc:'Cool winter night.'},
    {id:'bn_autumn',name:'Autumn Winds',   tag:'Banner',  tier:'cosmic',    price:250, kind:'banner', bg:'linear-gradient(160deg,#3a2412,#0c0c12)', desc:'Warm autumn tones.'},
    {id:'bn_aurora',name:'Aurora',         tag:'Banner',  tier:'special',   price:350, kind:'banner', bg:'linear-gradient(160deg,#10323a,#0c0c12)', desc:'Northern lights.'},
  ]},
  {key:'packs', title:'Get More Shards', layout:'grid', packs:true, items:[
    {id:'pk1', name:'Handful', amount:100,  kind:'pack'},
    {id:'pk2', name:'Pouch',   amount:550,  kind:'pack'},
    {id:'pk3', name:'Chest',   amount:1500, kind:'pack'},
    {id:'pk4', name:'Vault',   amount:5000, kind:'pack', best:true},
  ]},
];
const STORE_INDEX={}; STORE_SECTIONS.forEach(s=>s.items.forEach(it=>STORE_INDEX[it.id]=it));
const DEAL_POOL=STORE_SECTIONS.filter(s=>!s.packs).flatMap(s=>s.items).filter(it=>it.price>0);
function findItem(id){ return STORE_INDEX[id]; }
function isOwned(it){ return ['theme','border','banner'].includes(it.kind) && (S.owned||[]).includes(it.id); }
function isEquipped(it){ return (it.kind==='theme'&&S.theme===it.id)||(it.kind==='border'&&S.border===it.id)||(it.kind==='banner'&&S.banner===it.id); }
function shardSVG(px){ const id='sh'+px; return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" style="display:block;flex-shrink:0;"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="78%"><stop offset="0" stop-color="#a9ecff"/><stop offset="45%" stop-color="#33b5f5"/><stop offset="100%" stop-color="#1566d4"/></radialGradient></defs><circle cx="12" cy="12" r="9" fill="url(#${id})" stroke="#0a2a52" stroke-width="1"/><ellipse cx="9" cy="8.4" rx="3.1" ry="1.9" fill="#fff" opacity=".5"/></svg>`; }
function itemIcon(item){
  if(item.kind==='theme') return `<div style="width:62px;height:62px;border-radius:50%;border:3px solid ${(SHADES[item.tier]||SHADES.common).bd};background:linear-gradient(135deg,${item.accent2} 0 50%,${item.accent} 50% 100%);"></div>`;
  if(item.kind==='border'){ const ini=(S.name||'A').slice(0,1).toUpperCase(); return `<div style="width:54px;height:54px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;box-shadow:${item.ring||'none'};">${ini}</div>`; }
  if(item.kind==='banner') return `<div style="width:118px;height:56px;border-radius:12px;background:${item.bg||'var(--card2)'};border:1px solid var(--line2);"></div>`;
  if(item.kind==='pack') return shardSVG(58);
  return consumableArt(item.id, 46);
}
function dealFor(id){ if(!S.deals) return null; let d=(S.deals.reg||[]).find(x=>x.id===id); if(d) return {off:d.off,pro:false}; d=(S.deals.pro||[]).find(x=>x.id===id); if(d) return {off:d.off,pro:true}; return null; }
function itemCard(item, opts){
  opts=opts||{};
  const sh=SHADES[item.tier]||SHADES.common, owned=isOwned(item), equipped=isEquipped(item);
  const d=(opts.off!=null)?{off:opts.off,pro:!!opts.pro}:dealFor(item.id);
  const showDeal=d && (!d.pro || S.pro);
  const full=item.price, disc=showDeal?Math.round(full*(1-d.off/100)):full;
  let bottom;
  if(owned){ bottom = equipped?`<div class="sprice owned">✓ Equipped</div>`:`<button class="sprice owned" onclick="event.stopPropagation();equipItem('${item.id}')">Equip</button>`; }
  else { bottom = `<button class="sprice" onclick="event.stopPropagation();buyItem('${item.id}')">${(showDeal&&disc<full)?`<span class="old">${full}</span>`:''}${shardSVG(15)} ${disc}</button>`; }
  return `<div class="scard" style="border-color:${sh.bd};">
    ${showDeal?`<div class="sdeal">${d.off}%<br>OFF</div>`:''}
    <button class="sinfo" onclick="event.stopPropagation();storeInfo('${item.id}')">i</button>
    <div class="sname" style="color:${sh.nm};">${item.name}</div>
    <div class="stag" style="color:${sh.tg};">${item.tag}</div>
    <div class="sicon">${itemIcon(item)}</div>
    ${bottom}
    ${item.kind==='consumable'&&(S.inv[item.id]||0)>0?`<div class="tiny" style="margin-top:7px;color:var(--good);font-weight:800;">In bag ×${S.inv[item.id]}</div>`:''}
  </div>`;
}
function packCard(item){
  return `<div class="scard" style="border-color:#3f7fd6;">
    ${item.best?`<div class="sdeal" style="background:var(--good);color:#04120a;">BEST<br>VALUE</div>`:''}
    <button class="sinfo" onclick="event.stopPropagation();storeInfo('${item.id}')">i</button>
    <div class="sname" style="display:flex;align-items:center;gap:6px;color:#cfe2ff;">${shardSVG(17)} ${item.amount.toLocaleString()}</div>
    <div class="stag" style="color:#6fa8ff;">${item.name}</div>
    <div class="sicon">${itemIcon(item)}</div>
    <button class="sprice" onclick="event.stopPropagation();buyShards('${item.id}')" style="background:var(--good);color:#04120a;border-color:transparent;">${PACK_PRICE[item.id]||'$0.99'}</button>
  </div>`;
}
function renderSection(sec){
  const cards=(sec.packs?sec.items.map(packCard):sec.items.map(it=>itemCard(it))).join('');
  return `<div class="storeSec"><div class="storeSecHd"><h3>${sec.title}</h3></div><div class="${sec.layout==='grid'?'sgrid':'shelf'}">${cards}</div></div>`;
}
function dealsBlock(title, deals, which, locked){
  const cards=deals.map(d=>{ const it=findItem(d.id); return it?itemCard(it,{off:d.off,pro:(which==='pro')}):''; }).join('');
  return `<div class="storeSec"><div class="storeSecHd"><h3>${title}${locked?' 🔒':''}</h3><button class="reroll" onclick="rerollDeals('${which}')">${shardSVG(15)} ${ROLL_COST} ↻</button></div><div class="sgrid">${cards}</div></div>`;
}
function pickRandom(arr,n,exclude){ const pool=arr.filter(x=>!exclude.includes(x.id)); const out=[]; while(out.length<n && pool.length){ out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]); } return out; }
function dStr(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function genDeals(){ const reg=pickRandom(DEAL_POOL,2,[]).map(it=>({id:it.id,off:OFFERS[Math.floor(Math.random()*OFFERS.length)]})); const pro=pickRandom(DEAL_POOL,2,reg.map(x=>x.id)).map(it=>({id:it.id,off:OFFERS[Math.floor(Math.random()*OFFERS.length)]})); return {date:dStr(),reg,pro}; }
function ensureDeals(){ if(!S.deals || S.deals.date!==dStr()){ S.deals=genDeals(); save(); } }
function rerollDeals(which){ if((S.shards||0)<ROLL_COST){ toast('Not enough Shards'); return; } S.shards-=ROLL_COST; const other=(which==='reg'?S.deals.pro:S.deals.reg)||[]; const fresh=pickRandom(DEAL_POOL,2,other.map(x=>x.id)).map(it=>({id:it.id,off:OFFERS[Math.floor(Math.random()*OFFERS.length)]})); if(which==='reg') S.deals.reg=fresh; else S.deals.pro=fresh; save(); renderTopbar(); renderStore(); }
function buyItem(id){
  const item=findItem(id); if(!item) return;
  if(isOwned(item)){ equipItem(id); return; }
  const d=dealFor(id), showDeal=d && (!d.pro||S.pro);
  const price=showDeal?Math.round(item.price*(1-d.off/100)):item.price;
  if((S.shards||0)<price){ toast('Not enough Shards — earn more by training'); return; }
  S.shards-=price;
  if(item.kind==='consumable'){ S.inv[id]=(S.inv[id]||0)+1; haptic&&haptic([0,30]); toast('✓ Bought '+item.name); }
  else { S.owned.push(id); toast('✓ Unlocked '+item.name+' — tap Equip'); }
  save(); renderTopbar(); renderStore();
}
function equipItem(id){
  const item=findItem(id); if(!item||!isOwned(item)) return;
  if(item.kind==='theme') S.theme=id; else if(item.kind==='border') S.border=id; else if(item.kind==='banner') S.banner=id;
  save(); applyTheme(); renderTopbar(); renderStore(); toast('Equipped '+item.name);
}
function buyShards(id){ const it=findItem(id); toast('💎 '+(it?it.amount.toLocaleString()+' Shards · ':'')+'real purchases arrive with the live app'); }
function reviveCap(id){ return id==='rest30'?30:id==='rest60'?60:id==='phoenix'?Infinity:0; }
function useItem(id){
  const it=findItem(id); if(!it || !(S.inv[id]>0)) return;
  if(id==='freeze'){ toast('🧊 Freezes work automatically — they trigger when your streak is about to break'); return; }
  if(id==='xp2'||id==='xp3'){
    if(S.boost){ toast('A shake is already active — finish a workout first'); return; }
    S.inv[id]--; S.boost=(id==='xp2'?2:3);
    haptic([0,30]); toast('🥤 '+S.boost+'× XP active for your next workout');
  } else {                                            // revives
    reconcileStreak();
    if(S.stk){ toast('Your streak is alive — nothing to revive'); return; }
    if(!S.stkLost){ toast('No broken streak to revive'); return; }
    if(S.stkLost.count>reviveCap(id)){ toast('That streak ('+S.stkLost.count+' days) needs a stronger revive'); return; }
    S.inv[id]--;
    const today=day0(Date.now());
    S.stk={start:today-(S.stkLost.count-1)*DAY, last:today, frozen:[]};
    S.stkLost=null;
    haptic([0,40,40,80]); toast((id==='phoenix'?'🐦‍🔥':'🔥')+' Streak revived — '+streakCount()+' days!');
  }
  save(); renderTopbar(); renderInvCard();
  if(document.getElementById('streakScreen').classList.contains('show')) renderStreakScreen();
  if(document.getElementById('screen-profile').classList.contains('active')) renderStreaksCard();
}
function renderInvCard(){
  const el=document.getElementById('invCard'); if(!el) return;
  reconcileStreak();
  const ids=['xp2','xp3','freeze','rest30','rest60','phoenix'];
  const owned=ids.filter(id=>(S.inv[id]||0)>0);
  const rows=owned.map(id=>{
    const it=findItem(id), n=S.inv[id];
    let act;
    if(id==='freeze') act=`<span class="tiny" style="color:var(--accent2);font-weight:800;">AUTO</span>`;
    else if(id==='xp2'||id==='xp3') act=S.boost?`<span class="tiny" style="color:var(--mut2);font-weight:800;">SHAKE ACTIVE</span>`:`<button class="btn ghost sm" style="padding:7px 14px;" onclick="useItem('${id}')">Use</button>`;
    else { const can=!S.stk&&S.stkLost&&S.stkLost.count<=reviveCap(id); act=can?`<button class="btn sm" style="padding:7px 14px;" onclick="useItem('${id}')">Revive</button>`:`<span class="tiny" style="color:var(--mut2);font-weight:700;">${S.stk?'STREAK OK':S.stkLost?'TOO SHORT':'NO LOSS'}</span>`; }
    return `<div class="row sb" style="padding:10px 0;border-bottom:1px solid var(--line);">
      <div class="row" style="gap:11px;"><div style="width:30px;display:flex;justify-content:center;">${consumableArt(id,22)}</div>
      <div><div style="font-weight:700;font-size:14px;">${it.name} <span class="tiny" style="color:var(--mut);font-weight:800;">×${n}</span></div>
      <div class="tiny muted">${it.desc}</div></div></div>${act}</div>`;
  }).join('');
  const boostLine=S.boost?`<div class="card flat" style="padding:11px 14px;margin:0 0 10px;display:flex;align-items:center;gap:9px;"><span style="color:${S.boost===3?'#ff7a3c':'#4ea3ff'};">${icon('shaker',19)}</span><div style="font-weight:700;font-size:13px;">${S.boost}× XP shake active — finishes with your next workout</div></div>`:'';
  el.innerHTML=`<div class="row sb" style="margin-bottom:${owned.length||S.boost?'12px':'6px'};">
      <h2 style="margin:0;">🎒 Inventory</h2>
      <span onclick="openStore()" style="color:var(--accent2);font-weight:700;font-size:14px;cursor:pointer;">Store ›</span>
    </div>
    ${boostLine}
    ${owned.length?rows:`<div class="tiny muted">No items yet — grab boosts, freezes & revives in the Store.</div>`}`;
}
function storeInfo(id){ const it=findItem(id); if(it) toast(it.name+(it.desc?' — '+it.desc:'')); }
function applyTheme(){ const it=S.theme?findItem(S.theme):null; document.documentElement.style.setProperty('--accent', (it&&it.accent)||'#9d5cff'); document.documentElement.style.setProperty('--accent2', (it&&it.accent2)||'#c3a3ff'); }
function applyBorder(){ const it=S.border?findItem(S.border):null, ring=(it&&it.ring)||''; ['tbAv','pfAvatar'].forEach(idd=>{ const el=document.getElementById(idd); if(el) el.style.boxShadow=ring; }); }
function applyBanner(){ const it=S.banner?findItem(S.banner):null, el=document.getElementById('pfIdCard'); if(el) el.style.background=(it&&it.bg)||''; }
let storeTimer=null;
function tickDealTimer(){ const el=document.getElementById('dealTimer'); if(!el){ if(storeTimer){clearInterval(storeTimer);storeTimer=null;} return; } const now=new Date(), mid=new Date(now); mid.setHours(24,0,0,0); let s=Math.max(0,Math.floor((mid-now)/1000)); const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60,p=v=>String(v).padStart(2,'0'); el.textContent='Deals refresh in '+p(h)+'h '+p(m)+'m '+p(ss)+'s'; }
function openStore(){ ensureDeals(); document.getElementById('storeScreen').classList.add('show'); renderStore(); if(storeTimer) clearInterval(storeTimer); tickDealTimer(); storeTimer=setInterval(tickDealTimer,1000); }
function closeStore(){ document.getElementById('storeScreen').classList.remove('show'); if(storeTimer){ clearInterval(storeTimer); storeTimer=null; } }
function renderStore(){
  ensureDeals();
  const proBanner=`<div class="card" onclick="openPro()" style="cursor:pointer;background:linear-gradient(90deg,var(--accent),var(--accent2));border:none;margin:0;">
    <div class="row sb"><div><div style="font-weight:900;color:#fff;font-size:16px;">ASCEND Pro</div><div style="font-size:12px;color:rgba(255,255,255,.85);">${S.pro?'Active — thanks for the support!':'Try it free · unlock everything'}</div></div><div style="font-weight:900;color:#fff;background:rgba(0,0,0,.22);padding:8px 12px;border-radius:10px;font-size:13px;">${S.pro?'✓ PRO':'GO PRO ›'}</div></div>
  </div>`;
  document.getElementById('storeScreen').innerHTML=`
    <div class="anhead"><button onclick="closeStore()" style="background:none;color:var(--txt);font-size:24px;width:34px;flex-shrink:0;">←</button>
      <div class="grow" style="text-align:center;font-weight:800;font-size:17px;">Store <span style="font-size:10px;color:var(--accent2);font-weight:800;vertical-align:super;">BETA</span></div>
      <div style="display:flex;align-items:center;gap:5px;font-weight:800;font-size:15px;justify-content:flex-end;">${shardSVG(20)} ${(S.shards||0).toLocaleString()}</div>
    </div>
    <div class="anbody">
      ${proBanner}
      <div class="dealtimer" id="dealTimer">Deals refresh in --</div>
      ${dealsBlock('Daily Deals', S.deals.reg, 'reg', false)}
      ${dealsBlock('Pro Deals', S.deals.pro, 'pro', !S.pro)}
      ${STORE_SECTIONS.map(renderSection).join('')}
      <div class="tiny muted" style="text-align:center;margin:22px 0 6px;">Earn Shards by training — gym time, sets & PRs · ×1.1 while on a streak 🔥</div>
    </div>`;
}
// A readable muscle name per exercise (finer than the 6 score groups) for the "last session" summary.
function exMuscle(id){
  const g=(EXMAP[id]||{}).group;
  if(g==='Arms'){
    if(/wrist/.test(id)) return 'Forearms';
    return /curl|hammer|preacher|spider|concentration/.test(id) ? 'Biceps' : 'Triceps';
  }
  if(g==='Back'){
    if(/shrug/.test(id)) return 'Traps';
    if(/goodmorning|backext/.test(id)) return 'Lower Back';
    return 'Back';
  }
  if(g==='Legs'){
    if(/rdl|legcurl|nordic|stiff/.test(id)) return 'Hamstrings';
    if(/hip|kickback/.test(id)) return 'Glutes';
    if(/calf/.test(id)) return 'Calves';
    if(/adductor|abductor/.test(id)) return 'Adductors';
    return 'Quads';
  }
  return g||'';
}
function sessionMuscles(ses){
  const cnt={}; ses.exercises.forEach(ex=>{ const m=exMuscle(ex.id); if(m) cnt[m]=(cnt[m]||0)+ex.sets.length; });
  return Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);   // most-trained first
}
function relDay(ts){ const d=new Date(ts); d.setHours(0,0,0,0); const t=new Date(); t.setHours(0,0,0,0);
  const days=Math.round((t-d)/86400000); return days<=0?'Today':days===1?'Yesterday':days+' days ago'; }
function lastSessionBanner(){
  if(!S.sessions.length) return '';
  const ses=S.sessions[S.sessions.length-1], muscles=sessionMuscles(ses);
  if(!muscles.length) return '';
  return `<div class="card flat" style="padding:12px 15px;margin-bottom:14px;">
    <div class="row" style="gap:12px;"><span class="muted">${icon('calendar',22)}</span>
      <div class="grow"><div class="tiny muted" style="text-transform:uppercase;letter-spacing:.4px;font-weight:700;">Last session · ${relDay(ses.start)}</div>
        <div style="font-weight:800;font-size:16px;margin-top:2px;">${muscles.join(' · ')}</div></div></div>
  </div>`;
}
function renderTrain(){
  renderTopbar();
  const wrap=document.getElementById('activeWorkout');
  const banner=document.getElementById('lastSessSlot');
  const none=document.getElementById('noWorkout');
  // The Start-empty / routines / memories screen is always rendered underneath, so it's
  // ready the moment the user minimizes the focus sheet.
  none.style.display='block'; renderRoutines(); renderMemories();
  if(!S.active){
    if(banner) banner.innerHTML=lastSessionBanner();
    if(wrap) wrap.innerHTML='';
    hideFocus();
    return;
  }
  if(banner) banner.innerHTML='';           // no "last session" banner while one is live
  if(wrap) wrap.innerHTML=activeWorkoutBodyHTML();
  showFocus();                              // reveal the focus sheet (expanded on first show)
  renderTimers();
}
// The exercises/sets body that lives inside the focus sheet. The session timer, Finish,
// Add-exercise and Rest controls are the sheet's own chrome (see index.html #focusSheet).
function activeWorkoutBodyHTML(){
  let html=`<div id="restWrap" style="display:none;"></div>`;
  if(!S.active.exercises.length) html+=`<p class="empty" style="padding:24px 18px;">No exercises yet — tap ＋ Add exercise below.</p>`;
  S.active.exercises.forEach((ex,ei)=>{
    const meta=EXMAP[ex.id]; const prev=lastPerf(ex.id,S.active.start);
    html+=`<div class="exwrap">
      <div class="row sb" style="margin-bottom:10px;">
        <div class="row" style="gap:10px;"><div style="width:34px;height:46px;border-radius:9px;overflow:hidden;background:#0c0c12;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${exDemoBody(ex.id, 42)}</div><div style="font-weight:700;">${meta.name}</div></div>
        <button class="btn danger sm" style="padding:6px 10px;" onclick="rmExercise(${ei})">✕</button>
      </div>
      <div class="colhdr"><div>SET</div><div>PREV</div><div>${S.units.toUpperCase()}</div><div>REPS</div><div></div></div>`;
    ex.sets.forEach((set,si)=>{
      const p=prev&&prev[si]; const ptxt=p?`${p.weight}×${p.reps}`:'—';
      html+=`<div class="swipe" data-ei="${ei}" data-si="${si}">
        <div class="swipe-del">${icon('trash',18)}</div>
        <div class="setrow ${set.done?'done':''}">
          <div class="sn">${si+1}</div>
          <div class="prev">${ptxt}</div>
          <input type="number" inputmode="decimal" placeholder="${p?p.weight:'wt'}" value="${set.weight||''}" onchange="setVal(${ei},${si},'weight',this.value)">
          <input type="number" inputmode="numeric" placeholder="${p?p.reps:'reps'}" value="${set.reps||''}" onchange="setVal(${ei},${si},'reps',this.value)">
          <button class="ck ${set.done?'on':''}" onclick="toggleDone(${ei},${si})">✓</button>
        </div>
      </div>`;
    });
    html+=`<button class="btn ghost sm" style="width:100%;margin-top:4px;" onclick="addSet(${ei})">＋ Add set</button></div>`;
  });
  html+=`<div style="text-align:center;margin:8px 0 4px;"><button class="btn danger sm" style="width:auto;padding:9px 18px;" onclick="cancelWorkout()">Discard workout</button></div>`;
  return html;
}
function renderRoutines(){
  const el=document.getElementById('routines');
  if(!S.routines.length){ el.innerHTML=emptyState('clipboard','No routines yet','Build one with ＋ New, or let Generate plan your day.'); return; }
  el.innerHTML=S.routines.map((rt,ri)=>{
    const sets=rt.items.reduce((a,i)=>a+i.sets,0);
    return `<div class="card flat" style="padding:13px 15px;">
      <div class="row sb">
        <div class="grow"><div style="font-weight:700;">${rt.name}</div>
          <div class="tiny muted">${rt.items.length} lifts · ${sets} sets</div></div>
        <button class="btn sm" style="padding:8px 14px;" onclick="startRoutine(${ri})">Start</button>
        <button class="btn danger sm" style="padding:8px 10px;" onclick="delRoutine(${ri})">🗑</button>
      </div></div>`;
  }).join('');
}
