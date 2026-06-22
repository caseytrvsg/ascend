// ---------- Discovery / Social Feed (cloud-backed) ----------
let feedScope='foryou', feedCache=null, feedAt=0, feedLoading=false;
function setFeedScope(el,s){ document.querySelectorAll('#feedScope .chip').forEach(c=>c.classList.remove('on')); el.classList.add('on'); feedScope=s; renderFeed(); }
function guessSplit(ses){ const cnt={}; ses.exercises.forEach(e=>{const g=EXMAP[e.id].group; cnt[g]=(cnt[g]||0)+1;}); let best='Full Body',m=0; for(const g in cnt) if(cnt[g]>m){m=cnt[g];best=g;} return best+' Day'; }
function relTime(iso){ const s=Math.floor((Date.now()-new Date(iso).getTime())/1000);
  if(s<60) return 'now'; if(s<3600) return Math.floor(s/60)+'m'; if(s<86400) return Math.floor(s/3600)+'h';
  if(s<604800) return Math.floor(s/86400)+'d'; return Math.floor(s/604800)+'w'; }
async function refreshFeed(){
  if(!(window.cloud&&cloud.ready())||feedLoading) return;
  feedLoading=true;
  try{ feedCache=await cloud.getFeed(); feedAt=Date.now(); renderFeed(true); }catch(e){}
  feedLoading=false;
}
// Normalise a cloud feed row into the shape the renderer uses.
function normPost(p){
  const a=p.payload||{};
  return { id:p.id, type:p.type, mine:p.mine, user:p.mine?(S.name||'You'):(p.author&&p.author.username)||'?',
    sr:p.mine?overallSR():((p.author&&p.author.sr)||0), when:relTime(p.created_at),
    caption:a.caption, workout:a.workout, rank:a.rank, lift:a.lift, wt:a.wt, reps:a.reps, units:a.units||S.units,
    media:p.media_url, likes:p.likeCount, liked:p.liked };
}
function workoutPostBlock(w){
  const cf=actColorFn(w.act); const u=w.units||S.units;
  return `<div style="background:var(--card2);border-radius:14px;padding:12px;margin-top:10px;">
    <div class="row sb"><div style="font-weight:700;">${icon('barbell',16)} ${escapeHtml(w.title)}</div><div class="tiny muted">${w.sets} sets · ${fmt(w.vol)} ${u}</div></div>
    <div style="display:flex;justify-content:center;gap:8px;margin-top:8px;">${bodySVG('front',cf,94)}${bodySVG('back',cf,94)}</div>
    <div class="tiny muted" style="text-align:center;margin-top:4px;">Muscles trained · brighter = more volume</div>
  </div>`;
}
function renderFeed(fromRefresh){
  const signedIn=window.cloud&&cloud.ready();
  // Signed in → cloud feed; signed out → local posts only (offline fallback).
  let posts;
  if(signedIn&&feedCache) posts=feedCache.map(normPost);
  else if(!signedIn) posts=(S.posts||[]).map(p=>({id:'u'+p.ts, type:p.type||'post', mine:true, user:S.name||'You', sr:overallSR(), when:p.when||'now', caption:p.caption, workout:p.workout, media:p.media, units:S.units, likes:p.likes||0, liked:false}));
  else posts=[];
  if(feedScope==='friends') posts=posts.filter(p=>!p.mine);
  window._feed=posts;
  if(!fromRefresh && signedIn && (!feedCache || Date.now()-feedAt>20000)) refreshFeed();
  const ini0=(S.name||'A').slice(0,1).toUpperCase();
  const nudgeBadge = socialCount() ? `<span style="background:var(--bad);color:#fff;border-radius:999px;font-size:11px;font-weight:800;padding:1px 7px;margin-left:6px;">${socialCount()}</span>` : '';
  let html=`<button class="btn ghost" onclick="openFriends()" style="margin-bottom:10px;">${icon('users',17)} Friends · challenge &amp; nudge${nudgeBadge}</button>
    <div class="card" onclick="openCompose()" style="display:flex;align-items:center;gap:12px;cursor:pointer;">
      <div class="avatar" style="background:var(--accent);color:#fff;">${ini0}</div>
      <div class="grow muted" style="font-size:14px;">Share your workout…</div>
      <span class="muted">${icon('camera',19)}</span></div>`;
  html += posts.map((p,i)=>{
    const r=rankFor(p.sr), det=rankDetail(p.sr), initials=p.user.slice(0,2).toUpperCase(), u=p.units||S.units;
    let body='';
    if(p.type==='rankup') body=`<div style="background:${r.color}14;border:1px solid ${r.color}44;border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;margin-top:10px;">${rankEmblem(r,40)}<div><div style="font-weight:800;color:${r.color};">Ranked up to ${escapeHtml(p.rank||r.name)}!</div><div class="tiny muted">A new tier unlocked</div></div></div>`;
    else if(p.type==='pr') body=`<div style="margin-top:10px;"><div style="font-weight:700;"><span style="color:var(--warn);">${icon('trophy',16)}</span> New PR · ${escapeHtml(p.lift||'')}</div><div style="font-size:22px;font-weight:900;margin-top:2px;">${p.wt} ${u} × ${p.reps}</div><div class="tiny muted">Personal best</div></div>`;
    else body=(p.media?`<img src="${p.media}" style="width:100%;border-radius:14px;margin-top:10px;display:block;">`:'')
        +(p.caption?`<div style="margin-top:10px;">${escapeHtml(p.caption)}</div>`:'')
        +(p.workout?workoutPostBlock(p.workout):'');
    const liked=p.liked;
    return `<div class="card">
      <div class="row" style="gap:10px;">
        <div class="avatar" style="background:${r.color};">${initials}</div>
        <div class="grow"><div style="font-weight:700;">${escapeHtml(p.user)} ${p.mine?'<span class="tiny" style="color:var(--accent2)">· you</span>':''}</div>
          <div class="tiny" style="color:${r.color};font-weight:600;display:flex;align-items:center;gap:4px;">${rankEmblem(r,13)} ${r.name}${det.division?' '+det.division:''}</div></div>
        <div class="tiny muted">${p.when}</div>
        ${p.mine&&typeof p.id==='number'?`<button class="portbtn" style="padding:4px 8px;margin-left:4px;color:var(--bad);" onclick="deleteFeedPost(${p.id})">✕</button>`:''}
      </div>
      ${body}
      <div class="feedact">
        <button class="${liked?'liked':''}" onclick="toggleLike(${i})">${liked?'<span style="color:#ff4d6a;">'+icon('heart',15)+'</span>':icon('heartO',15)} ${p.likes||0}</button>
      </div></div>`;
  }).join('');
  if(!posts.length) html+=emptyState('sparkle', feedScope==='friends'?'No posts from friends yet':'Your feed is empty',
    feedScope==='friends'?'When your friends share workouts, PRs and rank-ups, they land here.':'Finish a workout and share it — your posts, PRs and rank-ups will show up here.');
  document.getElementById('feedBody').innerHTML=html;
}
async function toggleLike(i){
  const p=window._feed[i]; if(!p||typeof p.id!=='number') return;
  const on=!p.liked; p.liked=on; p.likes=(p.likes||0)+(on?1:-1); haptic(on?[0,15,30,15]:10);
  // update cache + re-render optimistically
  if(feedCache){ const c=feedCache.find(x=>x.id===p.id); if(c){ c.liked=on; c.likeCount=p.likes; } }
  renderFeed(true);
  try{ await cloud.toggleLike(p.id, on); }catch(e){ /* will reconcile on next refresh */ }
}
async function deleteFeedPost(id){
  if(!confirm('Delete this post?')) return;
  try{ await cloud.deletePost(id); if(feedCache) feedCache=feedCache.filter(p=>p.id!==id); renderFeed(true); toast('Post deleted'); }
  catch(e){ toast('Could not delete the post'); }
}

// ----- Compose a post (caption + photo + today's workout bodygraph) -----
let composeMedia=null, composeWorkout=false;
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/\n/g,'<br>'); }
function openCompose(){ composeMedia=null; composeWorkout=!!S.sessions.length; document.getElementById('composeCap').value=''; renderComposePreview(); openModal('composeModal'); }
// Shared image reader: downscales to <=900px and returns a JPEG data-URL via cb.
function readImage(input, cb){ const f=input.files&&input.files[0]; if(!f) return; const rd=new FileReader();
  rd.onload=()=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'), max=900; let w=img.width,h=img.height;
    if(w>h&&w>max){h=Math.round(h*max/w);w=max;} else if(h>=w&&h>max){w=Math.round(w*max/h);h=max;}
    c.width=w;c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); cb(c.toDataURL('image/jpeg',0.72)); };
    img.src=rd.result; }; rd.readAsDataURL(f); }
function pickMedia(input){ readImage(input,u=>{ composeMedia=u; renderComposePreview(); }); }
function clearMedia(){ composeMedia=null; renderComposePreview(); }
function toggleComposeWorkout(){ composeWorkout=!composeWorkout; renderComposePreview(); }
function renderComposePreview(){
  let h='';
  if(composeMedia) h+=`<div style="position:relative;margin-top:12px;"><img src="${composeMedia}" style="width:100%;border-radius:14px;display:block;"><button class="btn danger sm" style="position:absolute;top:8px;right:8px;padding:6px 10px;" onclick="clearMedia()">✕</button></div>`;
  const ses=S.sessions[S.sessions.length-1];
  if(ses){ const cf=actColorFn(activationForSession(ses));
    h+=`<div class="card flat" style="margin-top:12px;padding:12px;margin-bottom:0;">
      <div class="row sb"><div><div style="font-weight:700;">Attach today's workout</div><div class="tiny muted">${guessSplit(ses)} · adds your muscle bodygraph</div></div>
        <button class="chip ${composeWorkout?'on':''}" onclick="toggleComposeWorkout()">${composeWorkout?'✓ Added':'Add'}</button></div>
      ${composeWorkout?`<div style="display:flex;justify-content:center;gap:8px;margin-top:10px;">${bodySVG('front',cf,80)}${bodySVG('back',cf,80)}</div>`:''}
    </div>`;
  }
  document.getElementById('composePreview').innerHTML=h;
}
async function submitPost(){
  const cap=document.getElementById('composeCap').value.trim();
  if(!cap && !composeMedia && !composeWorkout){ toast('Add a caption, photo, or workout'); return; }
  let workout=null; const ses=S.sessions[S.sessions.length-1];
  if(composeWorkout && ses) workout={title:guessSplit(ses), sets:ses.exercises.reduce((a,e)=>a+e.sets.length,0), vol:sessionVolume(ses), act:activationForSession(ses), units:S.units};
  if(window.cloud && cloud.ready()){
    closeModal('composeModal'); haptic([0,25,40,25]); toast('Posting…');
    try{ await cloud.createPost('post', {caption:cap, workout}, composeMedia); await refreshFeed(); toast('Posted to feed'); }
    catch(e){ toast('Could not post — check your connection'); }
    return;
  }
  // signed-out fallback: keep it local
  S.posts=S.posts||[]; S.posts.unshift({type:'post', caption:cap, media:composeMedia, workout, when:'now', likes:0, comments:0, ts:Date.now()});
  if(S.posts.length>20) S.posts.length=20;
  try{ save(); }catch(e){ toast('Posted (photo too large to save offline)'); }
  closeModal('composeModal'); haptic([0,25,40,25]); renderFeed(); toast('Posted to feed');
}

// ---------- Competitive mode (1v1 friend duels, cloud-backed) ----------
let compView='home', duelsCache=[], chFriend=null, chEx=null, activeDuel=null, duelPhoto=null;
const DUEL_LIFTS=['bench','squat','dead','ohp','rowBb','curlBb'];
const SOON={'2v2 Squads':'Team up · 2-on-2 ranked battles','Free-for-All':'8 lifters · last one standing','Ranked Tournaments':'Bracketed seasonal events'};
function compDetail(){ const c=S.comp||{tier:0,div:0,sr:0}; const asc=c.tier===ASC; return {rank:RANKS[c.tier], division:asc?null:DIV_LABELS[c.div], sr:c.sr, ascended:asc}; }
async function refreshDuels(){
  if(!(window.cloud&&cloud.ready())) return;
  try{ duelsCache=await cloud.listDuels(); if(document.getElementById('screen-compete').classList.contains('active')) renderCompete(); }catch(e){}
}
function openChallenge(friendId){ chFriend=friendId||null; chEx=null; compView='challenge'; go('compete'); renderCompete(); }
function pickChFriend(id){ chFriend=id; renderCompete(); }
function pickChEx(exId){ chEx=exId; renderCompete(); }
async function sendChallenge(){
  if(!chFriend){ toast('Pick a friend'); return; } if(!chEx){ toast('Pick a lift'); return; }
  try{ await cloud.challengeDuel(chFriend, chEx); haptic([0,30,40,30]); toast('Challenge sent ⚔️'); compView='home'; await refreshDuels(); renderCompete(); }
  catch(e){ toast(((e&&e.message)||'').includes('duplicate')?'Duel already pending':'Could not send challenge'); }
}
async function acceptDuel(id){ try{ await cloud.respondDuel(id,true); haptic(20); toast('Duel accepted — go lift ⚔️'); await refreshDuels(); }catch(e){ toast('Could not accept'); } }
async function declineDuel(id){ try{ await cloud.respondDuel(id,false); haptic(15); await refreshDuels(); }catch(e){ toast('Could not decline'); } }
function openSubmitDuel(id){ activeDuel=duelsCache.find(d=>d.id===id); duelPhoto=null; compView='submit'; renderCompete(); }
function pickDuelPhoto(input){ readImage(input,u=>{ duelPhoto=u; renderCompete(); }); }
async function submitMyLift(){
  const w=+document.getElementById('duelW').value;
  if(!w){ toast('Enter the weight you lifted'); return; }
  if(!duelPhoto){ toast(icon('camera',14)+' Add a proof photo'); return; }
  const d=activeDuel; compView='home'; toast('Submitting your lift…');
  try{
    await cloud.submitDuel(d.id, d.meSide, w, duelPhoto);
    await cloud.pullAll(); localStorage.setItem('ascend',JSON.stringify(S));  // refresh my comp (resolve may have changed it)
    await refreshDuels(); haptic([0,40,40,80]); toast('Lift submitted ⚔️');
  }catch(e){ toast('Could not submit — try again'); }
}
function duelLiftName(exId){ return (EXMAP[exId]&&EXMAP[exId].name)||exId; }
function duelRow(d){
  const them=d.them||{username:'?'}, tr=rankFor(them.sr||0), ex=duelLiftName(d.ex_id);
  const mineW=d[d.meSide+'_weight'], theirSide=d.meSide==='c'?'o':'c', theirW=d[theirSide+'_weight'];
  const head=`<div class="row" style="gap:10px;align-items:center;">
    <div class="avatar" style="width:34px;height:34px;font-size:13px;background:${tr.color};">${them.username.slice(0,2).toUpperCase()}</div>
    <div class="grow"><div style="font-weight:700;">${escapeAttr(them.username)}</div><div class="tiny muted">${icon('swords',12)} ${escapeAttr(ex)}</div></div>`;
  if(d.status==='pending'){
    if(!d.iAmChallenger) return `<div class="card flat" style="padding:12px 14px;">${head}
      <button class="btn good sm" onclick="acceptDuel(${d.id})">Accept</button>
      <button class="btn danger sm" style="padding:8px 9px;" onclick="declineDuel(${d.id})">✕</button></div></div>`;
    return `<div class="card flat" style="padding:12px 14px;">${head}<div class="tiny muted">Waiting…</div></div></div>`;
  }
  if(d.status==='active'){
    if(mineW==null) return `<div class="card flat" style="padding:12px 14px;border:1px solid var(--accent);">${head}
      <button class="btn sm" onclick="openSubmitDuel(${d.id})">Lift</button></div></div>`;
    return `<div class="card flat" style="padding:12px 14px;">${head}<div class="tiny muted">${theirW==null?'Their turn…':'Resolving…'}</div></div></div>`;
  }
  if(d.status==='done'){
    const iWon=d.winner===cloud.user().id, draw=!d.winner, myDelta=d[d.meSide+'_delta']||0;
    const tag=draw?'<span class="tiny" style="color:var(--mut);font-weight:800;">DRAW</span>':iWon?'<span class="tiny" style="color:var(--good);font-weight:800;">WON</span>':'<span class="tiny" style="color:var(--bad);font-weight:800;">LOST</span>';
    return `<div class="card flat" style="padding:12px 14px;">${head}<div style="text-align:right;">${tag}<div class="tiny" style="color:${myDelta>=0?'var(--good)':'var(--bad)'};font-weight:800;">${myDelta>=0?'+':''}${myDelta} SR</div></div></div>
      <div class="tiny muted" style="margin-top:8px;">You ${mineW||'—'} ${S.units} · ${escapeAttr(them.username)} ${theirW||'—'} ${S.units}</div></div>`;
  }
  return '';
}
// ----- Matchup (VS) card: each lifter on their own banner, avatar ringed by their border -----
function bannerBg(bannerId, rankColor){ const it=bannerId&&findItem(bannerId); return (it&&it.bg)||`linear-gradient(160deg, ${rankColor}29, #0c0c12)`; }
function borderRing(borderId){ const it=borderId&&findItem(borderId); return (it&&it.ring)||'none'; }
function compRankOf(comp){ return RANKS[(comp&&comp.tier)||0]||RANKS[0]; }
function vsSide(name, rank, bannerId, borderId){
  return `<div class="dvside" style="background:${bannerBg(bannerId,rank.color)};">
    <div class="dvav" style="background:${rank.color};box-shadow:${borderRing(borderId)};">${(name||'?').slice(0,2).toUpperCase()}</div>
    <div class="dvname">${escapeAttr(name||'?')}</div>
    <div class="dvrank" style="color:${rank.color};">${rankEmblem(rank,15)} ${escapeAttr(rank.name)}</div>
  </div>`;
}
function vsBlock(them, exId){
  const myR=compRankOf(S.comp), tR=compRankOf(them.comp);
  return `<div class="dvwrap"><div class="dvcard">
    ${vsSide(S.name||'You', myR, S.banner, S.border)}
    ${vsSide(them.username||'?', tR, them.banner, them.border)}
    <div class="dvmid">VS</div>
  </div><div class="dvlift">${icon('swords',13)} ${escapeAttr(duelLiftName(exId))} · heaviest verified lift wins</div></div>`;
}

function renderCompete(){
  const el=document.getElementById('competeBody');
  const signedIn=window.cloud&&cloud.ready();
  if(compView==='challenge'){
    const fr=FR.friends.map(f=>f.other).filter(Boolean);
    el.innerHTML=`<div class="head"><h1>New duel</h1></div>
    <div class="card">
      <div class="tiny muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">Challenge a friend</div>
      ${fr.length?fr.map(u=>{ const r=rankFor(u.sr||0); return `<div class="row" style="gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--line);" onclick="pickChFriend('${u.id}')">
        <div class="avatar" style="width:32px;height:32px;font-size:12px;background:${r.color};">${u.username.slice(0,2).toUpperCase()}</div>
        <div class="grow"><div style="font-weight:700;">${escapeAttr(u.username)}</div><div class="tiny" style="color:${r.color};">${r.name} · ${u.sr||0} SR</div></div>
        ${chFriend===u.id?`<span style="color:var(--good);">✓</span>`:''}</div>`;}).join('')
        :`<div class="tiny muted" style="padding:6px 0 10px;">No friends yet — add some in the Social tab first.</div>`}
    </div>
    <div class="card">
      <div class="tiny muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">Pick the lift · heaviest wins</div>
      <div class="chiprow">${DUEL_LIFTS.map(x=>`<div class="chip ${chEx===x?'on':''}" onclick="pickChEx('${x}')">${duelLiftName(x)}</div>`).join('')}</div>
    </div>
    <button class="btn" onclick="sendChallenge()">${icon('swords',16)} Send challenge</button>
    <button class="btn ghost" style="margin-top:8px;" onclick="compView='home';renderCompete()">Cancel</button>`; return;
  }
  if(compView==='submit'){ const d=activeDuel; if(!d){ compView='home'; }
    else { const them=d.them||{username:'?'};
    el.innerHTML=`<div class="head"><h1>${duelLiftName(d.ex_id)}</h1></div>
    ${vsBlock(them, d.ex_id)}
    <div class="card">
      <p class="sub" style="text-align:center;margin-top:0;">Load the bar, lift it, and photograph the weight as proof. Heaviest verified lift wins.</p>
      <label class="f">Weight lifted (${S.units})</label>
      <input id="duelW" type="number" inputmode="decimal" placeholder="weight" style="margin-bottom:12px;">
      ${duelPhoto?`<div style="position:relative;"><img src="${duelPhoto}" style="width:100%;border-radius:12px;display:block;"><div class="pill" style="position:absolute;top:8px;left:8px;color:var(--good);border-color:var(--good);background:#0a0a0fcc;">✓ Proof attached</div><button class="btn danger sm" style="position:absolute;top:8px;right:8px;padding:6px 10px;" onclick="duelPhoto=null;renderCompete();">✕</button></div>`
        :`<label class="btn ghost" style="display:block;text-align:center;cursor:pointer;border-color:var(--warn);color:var(--warn);">${icon('camera',16)} Add proof of the weight · required<input type="file" accept="image/*" capture="environment" style="display:none;" onchange="pickDuelPhoto(this)"></label>`}
      <button class="btn" style="margin-top:14px;" onclick="submitMyLift()">Submit lift</button>
      <button class="btn ghost" style="margin-top:8px;" onclick="compView='home';renderCompete()">Back</button>
    </div>`; return; }
  }
  // home
  const cd=compDetail(), c=cd.rank.color, comp=S.comp||{wins:0,losses:0,streak:0};
  const incoming=duelsCache.filter(d=>d.status==='pending'&&!d.iAmChallenger);
  const yourTurn=duelsCache.filter(d=>d.status==='active'&&d[d.meSide+'_weight']==null);
  const waiting=duelsCache.filter(d=>(d.status==='pending'&&d.iAmChallenger)||(d.status==='active'&&d[d.meSide+'_weight']!=null));
  const results=duelsCache.filter(d=>d.status==='done').slice(0,8);
  const sect=(title,arr)=>arr.length?`<div class="tiny muted" style="text-transform:uppercase;letter-spacing:.5px;font-weight:800;margin:16px 2px 8px;">${title}</div>${arr.map(duelRow).join('')}`:'';
  el.innerHTML=`<div class="head"><p class="sub">Prove it head-to-head</p><h1>Competitive</h1></div>
  <div class="card" style="text-align:center;border-color:${c}44;background:linear-gradient(180deg,${c}14,var(--card));">
    <div style="display:flex;justify-content:center;">${rankEmblem(cd.rank,76,cd.division)}</div>
    <div style="font-size:21px;font-weight:800;color:${c};margin-top:4px;">${cd.rank.name}${cd.division?' '+cd.division:''}</div>
    <div class="tiny muted">${cd.ascended?cd.sr+' SR':cd.sr+' / 100 SR'} · Competitive ladder</div>
    <div class="statgrid" style="margin-top:14px;">
      <div class="stat"><div class="v">${comp.wins||0}–${comp.losses||0}</div><div class="l">Win / Loss</div></div>
      <div class="stat"><div class="v" style="display:flex;align-items:center;gap:4px;justify-content:center;">${comp.streak>0?flameSVG(16)+' '+comp.streak:comp.streak<0?'<span style="color:#9fd8ff;">'+icon('snowflake',15)+'</span> '+Math.abs(comp.streak):'—'}</div><div class="l">Streak</div></div>
    </div>
  </div>
  ${signedIn?`<button class="btn" onclick="openChallenge()">${icon('swords',17)} Challenge a friend</button>`
    :`<div class="card">${emptyState('cloud','Sign in to duel','Duels are 1v1 against your friends — sign in and add friends to start.')}</div>`}
  ${sect('Your turn — go lift', yourTurn)}
  ${sect('Challenge requests', incoming)}
  ${sect('Waiting on them', waiting)}
  ${sect('Recent results', results)}
  ${signedIn&&!duelsCache.length?`<p class="tiny muted" style="text-align:center;margin-top:20px;">No duels yet — challenge a friend and load the bar.</p>`:''}
  <p class="tiny muted" style="text-align:center;margin-top:18px;">Competitive rank is separate from your strength rank.</p>`;
}

// ---------- Friends (cloud-backed): search/add, requests, nudges ----------
const NUDGES=["Time to lift! 💪","The bar misses you 🏋️","Don't break the streak! 🔥","Your muscles won't grow themselves 😤","One session today — let's go ⚡","Get back on the grind 🚀"];
let FR={friends:[],reqIn:[],reqOut:[],nudges:[]}, frSearch=[], frSearchQ='', frSent={}, frT=null, nudgeCooldown={};
function socialCount(){ return FR.nudges.length + FR.reqIn.length; }
function streakDays(stk){ return stk&&stk.last&&stk.start ? Math.round((stk.last-stk.start)/86400000)+1 : 0; }
async function refreshSocial(){
  if(!(window.cloud&&cloud.ready())) return;
  try{
    const fs=await cloud.listFriendships(), nd=await cloud.listNudges();
    FR.friends=fs.filter(f=>f.status==='accepted');
    FR.reqIn=fs.filter(f=>f.status==='pending'&&!f.mine);
    FR.reqOut=fs.filter(f=>f.status==='pending'&&f.mine);
    FR.nudges=nd;
    if(document.getElementById('friendsModal').classList.contains('open')) renderFriends();
    if(document.getElementById('screen-feed').classList.contains('active')) renderFeed();
  }catch(e){}
}
function openFriends(){ renderFriends(); openModal('friendsModal'); refreshSocial(); }
function frDoSearch(q){
  frSearchQ=q; clearTimeout(frT);
  if(!q||q.trim().length<2){ frSearch=[]; renderFriends(); return; }
  frT=setTimeout(async()=>{ try{ frSearch=await cloud.searchUsers(q.trim()); }catch(e){ frSearch=[]; } renderFriends(); },250);
}
async function frAdd(id,uname){
  try{ await cloud.sendFriendRequest(id); frSent[id]=true; haptic([0,25]); toast('Request sent to '+uname); renderFriends(); refreshSocial(); }
  catch(e){ toast(((e&&e.message)||'').includes('duplicate')?'Already requested — or already friends':'Could not send the request'); }
}
async function frRespond(id,accept){
  try{ await cloud.respondFriend(id,accept); haptic(20); toast(accept?'Friend added 💪':'Request removed'); await refreshSocial(); renderFriends(); lbCache=null; }
  catch(e){ toast('Could not update the request'); }
}
async function ackNudge(id){ try{ await cloud.markNudgeSeen(id); }catch(e){} FR.nudges=FR.nudges.filter(n=>n.id!==id); haptic(20); renderFriends(); toast("Let's get after it 💪"); }
async function nudgeFriend(id,uname){
  if(nudgeCooldown[id]) return;
  const msg=NUDGES[Math.floor(Math.random()*NUDGES.length)];
  try{ await cloud.sendNudge(id,msg); nudgeCooldown[id]=true; haptic([0,20,30,20]); toast('Nudged '+uname+': "'+msg+'"'); renderFriends(); }
  catch(e){ toast('Could not nudge — check your connection'); }
}
function challengeFriend(id){ if(!(window.cloud&&cloud.ready())){ toast('Sign in to duel'); return; } closeModal('friendsModal'); openChallenge(id); }
function renderFriends(){
  const signedIn=window.cloud&&cloud.ready();
  const hadFocus=document.activeElement&&document.activeElement.id==='frSearch';
  let h=`<div class="grab"></div>
    <div class="row sb" style="margin-bottom:8px;"><h2 style="margin:0;">${icon('users',20)} Friends</h2><div class="tiny muted">${FR.friends.length} friend${FR.friends.length===1?'':'s'}</div></div>`;
  if(!signedIn){
    h+=emptyState('cloud','Sign in first','Friends live on your account, so they follow you to any device.');
    h+=`<button class="btn" onclick="closeModal('friendsModal');openAccount('signup')">Create account / Sign in</button>
      <button class="btn ghost" onclick="closeModal('friendsModal')" style="margin-top:8px;">Close</button>`;
    document.getElementById('friendsSheet').innerHTML=h; return;
  }
  h+=`<input id="frSearch" placeholder="Find friends by lifter name…" value="${escapeAttr(frSearchQ)}" oninput="frDoSearch(this.value)" style="margin-bottom:10px;">`;
  if(frSearch.length){
    h+=frSearch.map(u=>{ const r=rankFor(u.sr||0);
      const isFriend=FR.friends.some(f=>f.other&&f.other.id===u.id), isPend=frSent[u.id]||FR.reqOut.some(f=>f.other&&f.other.id===u.id);
      return `<div class="card flat" style="padding:10px 12px;"><div class="row" style="gap:10px;">
        <div class="avatar" style="width:34px;height:34px;font-size:13px;background:${r.color};">${u.username.slice(0,2).toUpperCase()}</div>
        <div class="grow"><div style="font-weight:700;">${escapeAttr(u.username)}</div><div class="tiny" style="color:${r.color};font-weight:600;">${r.name} · ${u.sr||0} SR</div></div>
        ${isFriend?'<span class="tiny" style="color:var(--good);font-weight:800;">FRIENDS</span>'
          :isPend?'<span class="tiny muted" style="font-weight:800;">REQUESTED</span>'
          :`<button class="btn sm" style="padding:8px 13px;" onclick="frAdd('${u.id}','${escapeAttr(u.username)}')">＋ Add</button>`}
      </div></div>`; }).join('');
  } else if(frSearchQ.trim().length>=2){
    h+=`<div class="tiny muted" style="text-align:center;padding:6px 0 10px;">No lifter named “${escapeAttr(frSearchQ.trim())}” yet — they need an ASCEND account first.</div>`;
  }
  FR.nudges.forEach(nd=>{ const un=(nd.sender&&nd.sender.username)||'A friend', r=rankFor((nd.sender&&nd.sender.sr)||0);
    h+=`<div class="card flat" style="border:1px solid var(--accent);padding:12px 14px;"><div class="row" style="gap:10px;">
      <div class="avatar" style="width:34px;height:34px;font-size:13px;background:${r.color};">${un.slice(0,2).toUpperCase()}</div>
      <div class="grow"><div style="font-weight:700;">${escapeAttr(un)} nudged you 👋</div><div class="tiny muted">${escapeAttr(nd.msg||'Time to lift!')}</div></div>
      <button class="btn sm" onclick="ackNudge(${nd.id})">Thanks</button></div></div>`; });
  if(FR.reqIn.length){
    h+=`<div class="tiny muted" style="text-transform:uppercase;letter-spacing:.5px;font-weight:800;margin:12px 2px 6px;">Friend requests</div>`;
    FR.reqIn.forEach(f=>{ const u=f.other||{username:'?'}, r=rankFor(u.sr||0);
      h+=`<div class="card flat" style="padding:12px 14px;"><div class="row" style="gap:10px;">
        <div class="avatar" style="width:36px;height:36px;font-size:14px;background:${r.color};">${u.username.slice(0,2).toUpperCase()}</div>
        <div class="grow"><div style="font-weight:700;">${escapeAttr(u.username)}</div><div class="tiny" style="color:${r.color};font-weight:600;">${r.name} · ${u.sr||0} SR</div></div>
        <button class="btn good sm" onclick="frRespond(${f.id},true)">Accept</button>
        <button class="btn danger sm" style="padding:8px 9px;" onclick="frRespond(${f.id},false)">✕</button></div></div>`; });
  }
  if(FR.reqOut.length){
    h+=`<div class="tiny muted" style="text-transform:uppercase;letter-spacing:.5px;font-weight:800;margin:12px 2px 6px;">Sent · pending</div>`;
    FR.reqOut.forEach(f=>{ h+=`<div class="card flat" style="padding:11px 14px;"><div class="row sb"><div class="tiny"><b>${escapeAttr((f.other&&f.other.username)||'?')}</b></div><div class="tiny muted">Waiting for them to accept…</div></div></div>`; });
  }
  if(!FR.friends.length) h+=emptyState('users','No friends yet','Search a lifter name above — once they accept, you appear on each other\'s leaderboards.');
  else {
    h+=`<div class="tiny muted" style="text-transform:uppercase;letter-spacing:.5px;font-weight:800;margin:14px 2px 6px;">Your friends</div>`;
    FR.friends.forEach(f=>{ const u=f.other||{username:'?'}, r=rankFor(u.sr||0), stk=streakDays(u.streak);
      h+=`<div class="card flat" style="padding:12px 14px;"><div class="row" style="gap:10px;">
        <div class="avatar" style="width:40px;height:40px;background:${r.color};">${u.username.slice(0,2).toUpperCase()}</div>
        <div class="grow"><div style="font-weight:700;">${escapeAttr(u.username)}</div>
          <div class="tiny" style="color:${r.color};font-weight:600;">${r.name} · ${u.sr||0} SR${stk>0?` · ${flameSVG(12)}${stk}`:''}</div></div>
        <button class="btn ghost sm" style="padding:8px 11px;" onclick="openChat('${u.id}','${escapeAttr(u.username)}')">${icon('chat',15)}</button>
        <button class="btn ghost sm" style="padding:8px 11px;" onclick="challengeFriend('${u.id}')">${icon('swords',15)}</button>
        <button class="btn ghost sm" style="padding:8px 11px;${nudgeCooldown[u.id]?'opacity:.5;':''}" ${nudgeCooldown[u.id]?'disabled':''} onclick="nudgeFriend('${u.id}','${escapeAttr(u.username)}')">${nudgeCooldown[u.id]?'✓':'👋'}</button>
      </div></div>`; });
  }
  h+=`<button class="btn ghost" onclick="closeModal('friendsModal')" style="margin-top:12px;">Close</button>`;
  document.getElementById('friendsSheet').innerHTML=h;
  if(hadFocus){ const s=document.getElementById('frSearch'); if(s){ s.focus(); s.setSelectionRange(s.value.length,s.value.length); } }
}
// ---------- Friend chat (cloud DMs + routine sharing) ----------
let chatWith=null, chatName='', chatLog=[], shareOpen=false;
async function openChat(id,name){
  if(!(window.cloud&&cloud.ready())){ toast('Sign in to message friends'); return; }
  chatWith=id; chatName=name||'Friend'; shareOpen=false; chatLog=[];
  closeModal('friendsModal'); document.getElementById('chatScreen').classList.add('show'); renderChat();
  try{ chatLog=await cloud.getMessages(id); renderChat(); }catch(e){}
}
function closeChat(){ document.getElementById('chatScreen').classList.remove('show'); chatWith=null; chatLog=[]; shareOpen=false; openFriends(); }
function chatBubble(m){
  if(m.routine){
    const r=m.routine, lifts=(r.items||[]).map(it=>EXMAP[it.id]?EXMAP[it.id].name:it.id).slice(0,4).join(' · ');
    return `<div class="bub ${m.me?'me':'them'}" style="padding:12px 13px;min-width:200px;">
      <div style="font-weight:800;font-size:13.5px;${m.me?'':'color:var(--accent2);'}">${icon('clipboard',14)} ${escapeAttr(r.name||'Routine')}</div>
      <div class="tiny" style="opacity:.85;margin-top:3px;">${(r.items||[]).length} lifts · ${(r.items||[]).reduce((a,i)=>a+(i.sets||3),0)} sets</div>
      <div class="tiny" style="opacity:.8;margin-top:5px;">${escapeAttr(lifts)}${(r.items||[]).length>4?' · …':''}</div>
      ${m.me?'':`<button class="btn sm" style="margin-top:9px;padding:7px 12px;" onclick="saveSharedRoutine(${m.ts})">＋ Save routine</button>`}
    </div>`;
  }
  return `<div class="bub ${m.me?'me':'them'}">${escapeAttr(m.text)}</div>`;
}
function renderChat(){
  if(!chatWith) return;
  const fr=FR.friends.find(f=>f.other&&f.other.id===chatWith), u=fr&&fr.other, r=rankFor(u?u.sr:0);
  const sharePanel=shareOpen?`<div style="border-top:1px solid var(--line2);padding:10px 14px;background:var(--card);max-height:190px;overflow-y:auto;">
      <div class="tiny muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Share a routine</div>
      ${(S.routines||[]).length?(S.routines||[]).map((rt,i)=>`<div class="row sb" style="padding:9px 0;border-bottom:1px solid var(--line);">
        <div><div style="font-weight:700;font-size:14px;">${escapeAttr(rt.name||'Routine')}</div><div class="tiny muted">${rt.items.length} lifts</div></div>
        <button class="btn sm" style="padding:7px 14px;" onclick="shareRoutine(${i})">Send</button></div>`).join(''):'<div class="tiny muted" style="padding:6px 0;">No routines yet — build one in the Workout tab.</div>'}
    </div>`:'';
  document.getElementById('chatScreen').innerHTML=`
    <div class="anhead" style="border-bottom:1px solid var(--line2);padding-bottom:11px;">
      <button onclick="closeChat()" style="background:none;color:var(--txt);font-size:24px;width:34px;flex-shrink:0;">←</button>
      <div class="avatar" style="width:34px;height:34px;font-size:13px;background:${r.color};">${chatName.slice(0,2).toUpperCase()}</div>
      <div class="grow"><div style="font-weight:800;">${escapeAttr(chatName)}</div><div class="tiny" style="color:${r.color};">${r.name}${u?' · '+(u.sr||0)+' SR':''}</div></div>
      <button class="btn ghost sm" style="padding:8px 11px;flex-shrink:0;" onclick="challengeFriend('${chatWith}')">${icon('swords',15)}</button>
    </div>
    <div class="chatlog" id="chatLog">${chatLog.map(chatBubble).join('')||'<div class="empty" style="margin:auto;text-align:center;">Say hi — or share a routine '+icon('clipboard',16)+'</div>'}</div>
    ${sharePanel}
    <div class="chatbar">
      <button onclick="toggleShareRoutine()" title="Share routine" style="background:var(--card2);border:1px solid var(--line2);border-radius:12px;color:var(--accent2);width:46px;flex-shrink:0;">${icon('clipboard',17)}</button>
      <input id="chatInput" placeholder="Message ${escapeAttr(chatName)}…" onkeydown="if(event.key==='Enter')sendChat()" style="flex:1;min-width:0;">
      <button class="btn sm" style="width:auto;padding:11px 16px;flex-shrink:0;" onclick="sendChat()">➤</button>
    </div>`;
  const el=document.getElementById('chatLog'); el.scrollTop=el.scrollHeight;
}
// A realtime message arrived from the friend we're chatting with → append it live.
function onChatMessage(row){
  if(chatWith && row.from_user===chatWith){
    chatLog.push({id:row.id, me:false, text:row.text, routine:row.routine, ts:new Date(row.created_at).getTime()});
    renderChat();
  } else { toast(icon('chat',14)+' New message'); }
}
async function sendChat(){
  const inp=document.getElementById('chatInput'), t=(inp.value||'').trim(); if(!t||!chatWith) return;
  inp.value='';
  chatLog.push({me:true,text:t,ts:Date.now()}); haptic(15); renderChat();
  try{ await cloud.sendMessage(chatWith, t, null); }catch(e){ toast('Message failed to send'); }
}
function toggleShareRoutine(){ shareOpen=!shareOpen; renderChat(); }
async function shareRoutine(i){
  const rt=(S.routines||[])[i]; if(!rt||!chatWith) return;
  const routine={name:rt.name,items:rt.items.map(x=>({...x}))};
  chatLog.push({me:true,routine,ts:Date.now()}); shareOpen=false; haptic([0,25,30,25]); renderChat();
  try{ await cloud.sendMessage(chatWith, null, routine); }catch(e){ toast('Could not share routine'); }
}
function saveSharedRoutine(ts){
  const m=chatLog.find(x=>x.ts===ts&&x.routine); if(!m) return;
  S.routines.push({name:m.routine.name+' · '+chatName, items:m.routine.items.map(x=>({...x}))});
  if(window.cloud && cloud.ready()) cloud.mark('routines');
  save(); haptic(25); toast(icon('clipboard',14)+' Saved to your routines');
}

