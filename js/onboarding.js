// ---------- Onboarding (new users) ----------
let onbStep=0, onb={};
const ONB_STEPS=['welcome','weight','height','age','activity','goal','plan','account'];
function startOnboarding(){
  onb={name:'', units:'lb', bw:'', hUnit:'cm', cm:'', ft:'', inch:'', age:'', activity:'moderate', goal:'', user:'', email:'', mode:'signup'};
  onbStep=0; document.getElementById('onboard').classList.add('show'); renderOnb();
}
function onbSet(k,v){ onb[k]=v; renderOnb(); }
function onbHUnit(u){ // capture before switch
  const cm=document.getElementById('onbCm'), ft=document.getElementById('onbFt'), inc=document.getElementById('onbIn');
  if(cm) onb.cm=cm.value; if(ft) onb.ft=ft.value; if(inc) onb.inch=inc.value;
  onb.hUnit=u; renderOnb();
}
function onbCapture(){ // pull current inputs into onb
  const g=id=>document.getElementById(id);
  if(g('onbName')) onb.name=g('onbName').value;
  if(g('onbBW')) onb.bw=g('onbBW').value;
  if(g('onbCm')) onb.cm=g('onbCm').value;
  if(g('onbFt')) onb.ft=g('onbFt').value;
  if(g('onbIn')) onb.inch=g('onbIn').value;
  if(g('onbAge')) onb.age=g('onbAge').value;
  if(g('onbUser')) onb.user=g('onbUser').value;
  if(g('onbEmail')) onb.email=g('onbEmail').value;
  if(g('onbPass')) onb.pass=g('onbPass').value;
}
function onbNext(){
  onbCapture();
  const step=ONB_STEPS[onbStep];
  if(step==='weight' && !(+onb.bw>0)){ toast('Enter your bodyweight'); return; }
  if(onbStep<ONB_STEPS.length-1){ onbStep++; renderOnb(); } else commitOnboarding();
}
function onbPrev(){ if(onbStep>0){ onbCapture(); onbStep--; renderOnb(); } }
function renderOnb(){
  const step=ONB_STEPS[onbStep];
  document.getElementById('onbBar').style.width=((onbStep+1)/ONB_STEPS.length*100)+'%';
  document.getElementById('onbBack').style.visibility = onbStep===0?'hidden':'visible';
  document.getElementById('onbNext').textContent = ONB_STEPS[onbStep]==='account'?(onb.mode==='signin'?'Sign in':'Create account'):'Next';
  let h='';
  if(step==='welcome'){
    h=`<div style="font-size:40px;margin-bottom:6px;">🛡️</div>
      <div class="onbq">Welcome to ASCEND</div>
      <div class="onbsub">A few quick questions so we can rank your strength fairly and tailor your plan.</div>
      <label class="f">What should we call you?</label>
      <input id="onbName" placeholder="Your name" value="${escapeAttr(onb.name)}">`;
  } else if(step==='weight'){
    h=`<div class="onbq">Your bodyweight</div><div class="onbsub">Your rank is your strength relative to bodyweight — this is the key number.</div>
      <div class="seg" style="margin-bottom:14px;"><button class="${onb.units==='lb'?'on':''}" onclick="onbSet('units','lb')">lb</button><button class="${onb.units==='kg'?'on':''}" onclick="onbSet('units','kg')">kg</button></div>
      <label class="f">Bodyweight (${onb.units})</label>
      <input id="onbBW" type="number" inputmode="decimal" placeholder="${onb.units==='kg'?'80':'180'}" value="${onb.bw}">`;
  } else if(step==='height'){
    const heightIn = onb.hUnit==='ft'
      ? `<div class="row" style="gap:10px;"><input id="onbFt" type="number" inputmode="numeric" placeholder="ft" value="${onb.ft}"><input id="onbIn" type="number" inputmode="numeric" placeholder="in" value="${onb.inch}"></div>`
      : `<input id="onbCm" type="number" inputmode="numeric" placeholder="cm" value="${onb.cm}">`;
    h=`<div class="onbq">Your height</div><div class="onbsub">Helps us personalise targets (and future body-ratio scoring).</div>
      <div class="seg" style="margin-bottom:14px;"><button class="${onb.hUnit==='cm'?'on':''}" onclick="onbHUnit('cm')">cm</button><button class="${onb.hUnit==='ft'?'on':''}" onclick="onbHUnit('ft')">ft / in</button></div>
      ${heightIn}`;
  } else if(step==='age'){
    h=`<div class="onbq">Your age</div><div class="onbsub">Used to estimate your calorie needs — metabolism shifts with age.</div>
      <label class="f">Age (years)</label>
      <input id="onbAge" type="number" inputmode="numeric" placeholder="e.g. 25" value="${onb.age}">`;
  } else if(step==='activity'){
    h=`<div class="onbq">How active are you?</div><div class="onbsub">Outside the gym too — this sets your daily calorie burn.</div>`
      +Object.keys(ACTIVITY).map(k=>`<button class="bigopt ${onb.activity===k?'sel':''}" onclick="onbSet('activity','${k}')"><span class="em">${ACTIVITY[k].em}</span><span><div>${ACTIVITY[k].label}</div><div class="tiny muted" style="font-weight:500;">${ACTIVITY[k].desc}</div></span></button>`).join('');
  } else if(step==='goal'){
    h=`<div class="onbq">Your main goal</div><div class="onbsub">Your nutrition plan is built around this.</div>`
      +GOALS.map(g=>`<button class="bigopt ${onb.goal===g?'sel':''}" onclick="onbSet('goal','${g}')"><span class="em">${g==='Build muscle'?'💪':g==='Get stronger'?'🏋️':g==='Lose fat'?'🔥':g==='Maintain'?'⚖️':'✨'}</span> ${g}</button>`).join('');
  } else if(step==='plan'){
    const kg = onb.units==='kg'? (+onb.bw||0) : (+onb.bw||0)/2.20462;
    const cm = onb.hUnit==='ft'? ((+onb.ft||0)*30.48+(+onb.inch||0)*2.54) : (+onb.cm||0);
    const pl = planFrom(kg, cm, +onb.age||30, actFactor(onb.activity), onb.goal);
    const m=cm/100, bmi=cm?(kg/(m*m)):0, cat=bmi<18.5?'Underweight':bmi<25?'Normal':bmi<30?'Overweight':'Obese';
    h=`<div class="onbq">Your AI plan 🤖</div><div class="onbsub">Built from your stats + goal. You can fine-tune it anytime.</div>
      ${bmi?`<div class="fooditem" style="margin-bottom:10px;"><div style="font-size:24px;">📊</div><div class="grow"><div style="font-weight:700;">BMI ${(Math.round(bmi*10)/10)}</div><div class="tiny muted">${cat}</div></div></div>`:''}
      <div class="statgrid">
        <div class="stat"><div class="v">${pl.kcal}</div><div class="l">Cal / day</div></div>
        <div class="stat"><div class="v">${pl.p}g</div><div class="l">Protein</div></div>
        <div class="stat"><div class="v">${pl.c}g</div><div class="l">Carbs</div></div>
        <div class="stat"><div class="v">${pl.f}g</div><div class="l">Fat</div></div>
      </div>
      <div class="tiny muted" style="margin-top:10px;line-height:1.6;">Maintenance ≈ ${pl.tdee} kcal → ${pl.adj} for ${onb.goal||'your goal'}.</div>`;
  } else if(step==='account'){
    const suggested=((onb.name||'').replace(/[^A-Za-z0-9_]/g,'')||'lifter');
    if(onb.mode==='signin'){
      h=`<div style="margin-bottom:8px;color:var(--accent2);">${icon('cloud',40)}</div>
        <div class="onbq">Welcome back</div>
        <div class="onbsub">Sign in and your lifts, rank and streaks load right onto this device.</div>
        ${appleBtnHTML()}
        <label class="f">Email</label>
        <input id="onbEmail" type="email" placeholder="you@email.com" value="${escapeAttr(onb.email||'')}">
        <label class="f" style="margin-top:10px;">Password</label>
        <input id="onbPass" type="password" placeholder="••••••••">
        <div class="tiny muted" style="margin-top:12px;">New here? <b style="color:var(--accent2);cursor:pointer;" onclick="onbCapture();onbSet('mode','signup')">Create an account</b></div>`;
    } else {
      h=`<div style="margin-bottom:8px;color:var(--accent2);">${icon('cloud',40)}</div>
        <div class="onbq">Save your progress</div>
        <div class="onbsub">Create your account — your data follows you to any device, and you're on the leaderboard when friends join.</div>
        ${appleBtnHTML()}
        <label class="f">Lifter name (public · 3–20 letters, numbers, _)</label>
        <input id="onbUser" placeholder="e.g. ${escapeAttr(suggested)}" value="${escapeAttr(onb.user||'')}">
        <label class="f" style="margin-top:10px;">Email</label>
        <input id="onbEmail" type="email" placeholder="you@email.com" value="${escapeAttr(onb.email||'')}">
        <label class="f" style="margin-top:10px;">Password (8+ characters)</label>
        <input id="onbPass" type="password" placeholder="••••••••">
        <div class="tiny muted" style="margin-top:12px;">Already have an account? <b style="color:var(--accent2);cursor:pointer;" onclick="onbCapture();onbSet('mode','signin')">Sign in instead</b></div>
        <div class="tiny muted" style="margin-top:6px;"><b style="cursor:pointer;" onclick="onbSkipAccount()">Skip for now</b> — keep my data on this device only.</div>`;
    }
  }
  document.getElementById('onbBody').innerHTML=h;
}
function applyOnbToS(){
  S.name=(onb.name||'').trim()||'Athlete';
  S.units=onb.units; S.bw=+onb.bw||(onb.units==='kg'?80:180);
  S.heightUnit=onb.hUnit;
  if(onb.hUnit==='ft'){ const ft=+onb.ft||0, inch=+onb.inch||0; S.heightCm=(ft||inch)?(ft*30.48+inch*2.54):null; }
  else S.heightCm=+onb.cm||null;
  S.age=+onb.age||null; S.activity=onb.activity||'moderate'; S.goal=onb.goal||null; S.calories=null; S.onboarded=true;
}
function finishOnb(msg){
  document.getElementById('onboard').classList.remove('show');
  haptic([0,40,40,80]); applyTheme(); renderTrain(); go('train'); toast(msg);
}
// ----- Sign in with Apple (OAuth) -----
// Reusable button markup + an "or" divider, shared by onboarding and the account sheet.
function appleBtnHTML(){
  return `<button type="button" class="btn-apple" onclick="appleSignIn()">
    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true"><path d="M13.29 9.6c-.02-2.03 1.66-3 1.73-3.05-.94-1.38-2.41-1.57-2.93-1.59-1.25-.13-2.44.73-3.07.73-.63 0-1.61-.71-2.65-.69-1.36.02-2.62.79-3.32 2.01-1.42 2.46-.36 6.1 1.02 8.1.67.98 1.47 2.08 2.52 2.04 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.63.63 1.09-.02 1.78-1 2.44-1.98.77-1.13 1.09-2.23 1.11-2.29-.02-.01-2.13-.82-2.15-3.26zM11.27 3.66c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.21-.52.6-.97 1.56-.85 2.48.9.07 1.83-.46 2.39-1.13z"/></svg>
    <span>Sign in with Apple</span></button>
    <div class="orline">or</div>`;
}
async function appleSignIn(){
  if(!(window.cloud && cloud.configured)){ toast('Sign-in is unavailable right now'); return; }
  try{ await cloud.signInWithOAuth('apple'); }   // redirects to Apple, then back to the app
  catch(e){ const m=(e&&e.message)||'';
    toast(/not enabled|Unsupported provider|validation_failed/i.test(m)
      ? 'Apple sign-in isn’t switched on yet — finish the Apple + Supabase setup'
      : /Failed to fetch/i.test(m) ? 'No connection — check your internet and try again'
      : 'Couldn’t start Apple sign-in — try again'); }
}
// Friendly wording for auth errors a non-technical user will actually hit.
function authErrMsg(e){ const m=(e&&e.message)||'';
  if(m.includes('confirm-email-on')) return 'Account needs email confirmation — the app owner must turn off "Confirm email" in Supabase';
  if(m.includes('Email not confirmed')) return 'This account is waiting on email confirmation — ask the app owner to enable it';
  if(m.includes('already registered')) return 'That email already has an account — tap "Sign in instead"';
  if(m.includes('Database error saving new user')) return 'That lifter name is taken — try another';
  if(m.includes('Invalid login credentials')) return 'Wrong email or password';
  if(m.includes('rate limit')) return 'Too many attempts right now — wait a few minutes and try again';
  if(m.includes('Failed to fetch')) return 'No connection — check your internet and try again';
  return m||'Something went wrong — try again'; }
let onbBusy=false;
async function commitOnboarding(){
  if(onbBusy) return;
  onbCapture();
  if(onb.mode==='signin'){
    const email=(onb.email||'').trim(), pass=onb.pass||'';
    if(!email||!pass){ toast('Enter your email and password'); return; }
    onbBusy=true;
    try{
      await cloud.signIn(email, pass);
      S.onboarded=true; await cloud.pullAll();
      localStorage.setItem('ascend', JSON.stringify(S));
      finishOnb('Welcome back, '+S.name+' ☁️');
    }catch(e){ toast(authErrMsg(e)); }
    finally{ onbBusy=false; }
    return;
  }
  const uname=(onb.user||'').trim(), email=(onb.email||'').trim(), pass=onb.pass||'';
  if(!/^[A-Za-z0-9_]{3,20}$/.test(uname)){ toast('Lifter name: 3–20 letters, numbers or _'); return; }
  if(!email.includes('@')){ toast('Enter a valid email'); return; }
  if(pass.length<8){ toast('Password needs 8+ characters'); return; }
  if(!cloud.configured){ toast('Accounts unavailable right now — Skip for now'); return; }
  onbBusy=true;
  try{
    await cloud.signUp(email, pass, uname);
    applyOnbToS(); S.profileUpdatedAt=Date.now();
    localStorage.setItem('ascend', JSON.stringify(S));
    cloud.queueAllLocal();
    finishOnb('Account created — welcome, '+S.name+' 🛡️');
  }catch(e){ toast(authErrMsg(e)); }
  finally{ onbBusy=false; }
}
function onbSkipAccount(){
  onbCapture(); applyOnbToS(); save();
  finishOnb('Welcome, '+S.name+' — time to climb 🛡️');
}

