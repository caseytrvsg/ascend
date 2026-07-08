// ---------- Nutrition (AI meal scan + macro tracking) ----------
// Macros are per the stated serving. AI detection is SIMULATED here; the real app
// sends the photo to a vision model (e.g. Claude vision) for live food + macro estimates.
const FOODS=[
  {name:'Grilled Chicken Breast', emoji:'🍗', serving:'120g', kcal:198, p:37, c:0,  f:4},
  {name:'Fried Chicken',          emoji:'🍗', serving:'120g', kcal:319, p:24, c:11, f:19},
  {name:'White Rice',             emoji:'🍚', serving:'150g', kcal:205, p:4,  c:45, f:0},
  {name:'Brown Rice',             emoji:'🍚', serving:'150g', kcal:165, p:4,  c:34, f:1},
  {name:'Broccoli',               emoji:'🥦', serving:'80g',  kcal:28,  p:2,  c:5,  f:0},
  {name:'Salmon Fillet',          emoji:'🐟', serving:'120g', kcal:233, p:25, c:0,  f:14},
  {name:'Whole Eggs',             emoji:'🥚', serving:'2 eggs',kcal:156, p:13, c:1,  f:11},
  {name:'Avocado',                emoji:'🥑', serving:'half',  kcal:160, p:2,  c:9,  f:15},
  {name:'Oats',                   emoji:'🥣', serving:'50g dry',kcal:190,p:7,  c:33, f:3},
  {name:'Greek Yogurt',           emoji:'🥛', serving:'170g', kcal:100, p:17, c:6,  f:0},
  {name:'Banana',                 emoji:'🍌', serving:'1 medium',kcal:105,p:1, c:27, f:0},
  {name:'Sweet Potato',           emoji:'🍠', serving:'150g', kcal:135, p:2,  c:31, f:0},
  {name:'Ground Beef 80/20',      emoji:'🥩', serving:'120g', kcal:287, p:24, c:0,  f:21},
  {name:'Lean Beef 95/5',         emoji:'🥩', serving:'120g', kcal:170, p:26, c:0,  f:7},
  {name:'Protein Shake',          emoji:'🥤', serving:'1 scoop',kcal:120,p:25, c:3,  f:2},
  {name:'Pasta',                  emoji:'🍝', serving:'150g', kcal:220, p:8,  c:43, f:1},
  {name:'Almonds',                emoji:'🥜', serving:'30g',  kcal:174, p:6,  c:6,  f:15},
  {name:'Apple',                  emoji:'🍎', serving:'1 medium',kcal:95, p:0, c:25, f:0},
];
const FOODMAP=Object.fromEntries(FOODS.map(f=>[f.name,f]));
function bwLbs(){ return S.units==='kg' ? S.bw*2.20462 : S.bw; }
function bwKg(){ return S.units==='kg' ? S.bw : S.bw/2.20462; }
// Activity multipliers (Harris-Benedict style) for turning BMR into daily burn (TDEE).
const ACTIVITY={
  sedentary:{label:'Sedentary',        desc:'Desk job, little exercise', factor:1.2,   em:'🛋️'},
  light:    {label:'Lightly active',   desc:'Train 1–3 days/week',       factor:1.375, em:'🚶'},
  moderate: {label:'Moderately active', desc:'Train 3–5 days/week',       factor:1.55,  em:'🏃'},
  active:   {label:'Very active',      desc:'Train 6–7 days/week',       factor:1.725, em:'🔥'},
  athlete:  {label:'Athlete',          desc:'Hard daily training / job', factor:1.9,   em:'🏆'},
};
function actFactor(key){ return (ACTIVITY[key]||ACTIVITY.moderate).factor; }
// The AI nutrition engine: BMR (Mifflin-St Jeor, sex-neutral constant) -> TDEE -> goal-adjusted target + macros.
function planFrom(kg, cm, age, factor, goal, bodyFat){
  age = age||30;
  let bmr, method;
  if(bodyFat>0){                                               // Katch-McArdle — uses lean mass, best for lifters
    const lbm = kg*(1 - bodyFat/100);
    bmr = Math.round(370 + 21.6*lbm); method='Katch-McArdle (lean mass)';
  } else if(cm){                                               // Mifflin-St Jeor, sex-neutral (-78 = midpoint of +5/-161)
    bmr = Math.round(10*kg + 6.25*cm - 5*age - 78); method='Mifflin-St Jeor';
  } else { bmr = Math.round(10*kg - 5*age + 600); method='estimate'; }
  const tdee = Math.round(bmr*factor);
  let kcal=tdee, adj='maintenance';
  if(goal==='Lose fat'){ kcal=Math.round(tdee*0.8);  adj='~20% deficit'; }
  else if(goal==='Build muscle'){ kcal=Math.round(tdee*1.1); adj='~10% surplus'; }
  else if(goal==='Get stronger'){ kcal=Math.round(tdee*1.05); adj='slight surplus'; }
  const lb=kg*2.20462;
  const pPerLb = goal==='Lose fat'?1.1 : goal==='Build muscle'?1.0 : goal==='Get stronger'?0.9 : 0.8;
  const p=Math.round(lb*pPerLb), f=Math.round(lb*0.35), c=Math.max(0, Math.round((kcal - p*4 - f*9)/4));
  return {bmr, tdee, kcal, p, c, f, adj, method};
}
function nutritionPlan(){ return planFrom(bwKg(), S.heightCm, S.age, actFactor(S.activity), S.goal, S.bodyFat); }
function bmiInfo(){
  if(!S.heightCm) return null;
  const m=S.heightCm/100, bmi=bwKg()/(m*m);
  return {bmi:Math.round(bmi*10)/10, cat: bmi<18.5?'Underweight':bmi<25?'Normal':bmi<30?'Overweight':'Obese'};
}
// Daily targets = AI plan, unless the user set a custom calorie override.
function macroTargets(){
  const pl=nutritionPlan();
  if(S.calories>0){ const c=Math.max(0, Math.round((S.calories - pl.p*4 - pl.f*9)/4)); return {kcal:S.calories, p:pl.p, c, f:pl.f, custom:true}; }
  return {kcal:pl.kcal, p:pl.p, c:pl.c, f:pl.f, custom:false};
}
function todayMeals(){ const day=new Date().toDateString(); return (S.meals||[]).filter(m=>m.day===day); }
function dayTotals(){ const t={kcal:0,p:0,c:0,f:0}; todayMeals().forEach(m=>{t.kcal+=m.kcal;t.p+=m.p;t.c+=m.c;t.f+=m.f;}); return t; }
function removeMeal(ts){ S.meals=(S.meals||[]).filter(m=>m.ts!==ts); save(); renderNutrition(); }
function renderNutrition(){
  const t=macroTargets(), d=dayTotals();
  const C=2*Math.PI*70, calPct=t.kcal?Math.min(1,d.kcal/t.kcal):0, off=C*(1-calPct);
  const remain=Math.max(0, Math.round(t.kcal-d.kcal));
  const bar=(label,cur,tgt,color)=>`<div class="macrobar"><div class="top"><span>${label}</span><span class="muted">${Math.round(cur)} / ${tgt} g</span></div><div class="barbg"><div class="barfill" style="width:${Math.min(100,tgt?cur/tgt*100:0)}%;background:${color};"></div></div></div>`;
  const meals=todayMeals();
  const log = meals.length ? meals.slice().reverse().map(m=>`<div class="fooditem">
      <div style="font-size:23px;">${m.emoji}</div>
      <div class="grow"><div style="font-weight:700;">${m.name}${m.mult!==1?' ×'+m.mult:''}</div>
        <div class="tiny muted">${m.serving} · ${m.kcal} kcal · P${Math.round(m.p)} C${Math.round(m.c)} F${Math.round(m.f)}</div></div>
      <button class="btn danger sm" style="padding:7px 9px;" onclick="removeMeal(${m.ts})">✕</button></div>`).join('')
    : `<div class="empty">No meals logged today — scan one!</div>`;
  document.getElementById('nutBody').innerHTML=`
    <button class="btn" onclick="openScan()" style="margin-bottom:10px;">${icon('camera',17)} Scan a meal</button>
    <button class="btn ghost" onclick="openBarcode()" style="margin-bottom:10px;">${icon('barcode',17)} Scan a barcode</button>
    <button class="btn ghost" onclick="openManualMeal()" style="margin-bottom:14px;">${icon('clipboard',17)} Type your meal</button>
    <div class="card" style="text-align:center;">
      <div class="calring">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <circle cx="85" cy="85" r="70" stroke="#17171f" stroke-width="12" fill="none"/>
          <circle cx="85" cy="85" r="70" stroke="var(--accent)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
        </svg>
        <div class="calcenter"><div style="font-size:30px;font-weight:900;">${Math.round(d.kcal)}</div><div class="tiny muted">/ ${t.kcal} kcal</div></div>
      </div>
      <div class="tiny muted" style="margin-top:8px;">${remain} kcal remaining today</div>
      <div style="text-align:left;">${bar('Protein',d.p,t.p,'#5ad1a0')}${bar('Carbs',d.c,t.c,'#ffb84d')}${bar('Fat',d.f,t.f,'#ff7a9c')}</div>
    </div>
    ${aiPlanCard()}
    <h2>Today's food</h2>
    <div>${log}</div>`;
}
function aiPlanCard(){
  const pl=nutritionPlan(), bmi=bmiInfo(), t=macroTargets();
  const need = !S.heightCm || !S.age;
  return `<div class="card">
    <div class="row sb" style="margin-bottom:10px;"><div style="font-weight:800;">🤖 Your AI plan</div>
      <div class="pill" style="border-color:var(--accent);color:var(--accent2);">${S.goal||'Set a goal'}</div></div>
    ${bmi?`<div class="row sb" style="margin-bottom:10px;"><div class="tiny muted">BMI</div>
      <div style="font-weight:700;">${bmi.bmi} · <span style="color:${bmi.cat==='Normal'?'var(--good)':bmi.cat==='Underweight'||bmi.cat==='Overweight'?'var(--warn)':'var(--bad)'}">${bmi.cat}</span></div></div>
      <div class="divider" style="margin:0 0 10px;"></div>`:''}
    <div class="statgrid">
      <div class="stat"><div class="v">${t.kcal}</div><div class="l">Cal / day${t.custom?' (custom)':''}</div></div>
      <div class="stat"><div class="v">${t.p}g</div><div class="l">Protein</div></div>
      <div class="stat"><div class="v">${t.c}g</div><div class="l">Carbs</div></div>
      <div class="stat"><div class="v">${t.f}g</div><div class="l">Fat</div></div>
    </div>
    <div class="tiny muted" style="margin-top:10px;line-height:1.7;">Maintenance ≈ <b>${pl.tdee} kcal</b> (BMR ${pl.bmr} via ${pl.method} × activity). We applied a <b>${pl.adj}</b> for <b>${S.goal||'your goal'}</b>.${S.bodyFat>0?` Body fat <b>${S.bodyFat}%</b>.`:''}</div>
    ${need?`<div class="tiny" style="color:var(--warn);margin-top:8px;">Add your height & age in Profile → Edit for a precise target${S.bodyFat>0?'':' (or body fat % for a lifter-accurate one)'}.</div>`:''}
  </div>`;
}
// ----- Meal scan — live camera snap; AI recognition arrives with the scan-meal
// Edge Function (needs the AI account). Until then: snap, then pick foods manually.
let scanPhoto=null, scanItems=[], scanView='photo', scanEditIdx=-1, scanQuery='';
function openScan(){ scanPhoto=null; scanItems=[]; scanView='photo'; scanQuery=''; renderScanSheet(); openModal('scanModal'); startMealCam(); }
async function startMealCam(){
  const v=document.getElementById('mealVideo'); if(!v) return;
  const res=await Scanner.start(v);
  const st=document.getElementById('mealCamStatus');
  if(!res.ok && st) st.textContent = res.reason==='insecure' ? 'Camera needs the secure app address — use the installed app or the https link'
    : res.reason==='denied' ? 'Camera blocked — allow camera access for ASCEND, or upload a photo below'
    : 'No camera on this device — upload a photo below';
}
function snapMeal(){
  const v=document.getElementById('mealVideo');
  if(!v || !v.videoWidth){ toast('Camera not ready — or use Upload below'); return; }
  scanPhoto=Scanner.snap(v); Scanner.stop();
  scanItems=[]; scanView='results'; haptic([0,25,40,25]); renderScanSheet();
}
function pickScanPhoto(input){ readImage(input,u=>{ Scanner.stop(); scanPhoto=u; scanItems=[]; scanView='results'; haptic([0,25,40,25]); renderScanSheet(); }); }
// AI meal recognition — the server (scan-meal fn) enforces the daily cap; this just reflects it.
async function aiIdentifyMeal(){
  if(!(window.cloud && cloud.ready())){ toast('Sign in to use AI recognition'); return; }
  const btn=document.getElementById('aiIdBtn'); if(btn){ btn.disabled=true; btn.textContent='✨ Identifying…'; }
  const res=await cloud.aiScanMeal(scanPhoto);
  const reset=t=>{ if(btn){ btn.disabled=false; btn.textContent=t; } };
  if(res && res.ok){
    (res.foods||[]).forEach(f=>scanItems.push({food:{name:f.name,emoji:f.emoji||'🍽️',serving:f.serving||'1 serving',
      kcal:f.kcal||0,p:f.p||0,c:f.c||0,f:f.f||0}, mult:1, conf:Math.round(f.confidence||90)}));
    renderScanSheet();
    toast((res.foods||[]).length?`AI added ${res.foods.length} item${res.foods.length>1?'s':''} — check & correct`:'AI couldn’t read the plate — add foods manually');
    return;
  }
  const reason=res&&res.reason;
  if(reason==='ai_user_limit'){ if(btn){ btn.textContent='✨ Daily AI limit reached'; } toast('Daily AI limit reached — add foods manually'); }   // hard stop: stays disabled
  else if(reason==='ai_global_limit'){ if(btn){ btn.textContent='✨ AI unavailable today'; } toast('AI is at capacity today — try again tomorrow'); }
  else if(reason==='ai-not-configured'){ reset('✨ Identify foods with AI'); toast('AI food recognition is coming soon'); }
  else if(reason==='signed-out'){ reset('✨ Identify foods with AI'); toast('Sign in to use AI recognition'); }
  else { reset('✨ Identify foods with AI'); toast('AI unavailable right now'); }
}
function scanTotals(){ const t={kcal:0,p:0,c:0,f:0}; scanItems.forEach(it=>{t.kcal+=it.food.kcal*it.mult;t.p+=it.food.p*it.mult;t.c+=it.food.c*it.mult;t.f+=it.food.f*it.mult;}); return t; }
function cyclePortion(i){ const o=[0.5,1,1.5,2]; scanItems[i].mult=o[(o.indexOf(scanItems[i].mult)+1)%o.length]; renderScanSheet(); }
function removeScanItem(i){ scanItems.splice(i,1); renderScanSheet(); }
function editScanItem(i){ scanEditIdx=i; scanQuery=''; scanView='pickfood'; renderScanSheet(); }
function addScanItem(){ scanEditIdx=-2; scanQuery=''; scanView='pickfood'; renderScanSheet(); }
function selectFood(name){ const f=FOODMAP[name]; if(!f) return; if(scanEditIdx===-2) scanItems.push({food:f,mult:1,conf:100}); else { scanItems[scanEditIdx].food=f; scanItems[scanEditIdx].conf=100; } scanView='results'; renderScanSheet(); }
function filterFoods(q){ scanQuery=q; const list=FOODS.filter(f=>f.name.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('foodList').innerHTML = list.length? list.map(f=>`<div class="fooditem" onclick="selectFood('${f.name}')"><div style="font-size:22px;">${f.emoji}</div><div class="grow"><div style="font-weight:700;">${f.name}</div><div class="tiny muted">${f.serving} · ${f.kcal} kcal · P${f.p} C${f.c} F${f.f}</div></div><div class="muted">＋</div></div>`).join('') : '<div class="empty">No match.</div>'; }
function logMeal(){
  if(!scanItems.length){ toast('Nothing to log'); return; }
  const day=new Date().toDateString(); S.meals=S.meals||[];
  scanItems.forEach((it,k)=>S.meals.push({day, ts:Date.now()+k, name:it.food.name, emoji:it.food.emoji, serving:it.food.serving, mult:it.mult,
    kcal:Math.round(it.food.kcal*it.mult), p:+(it.food.p*it.mult).toFixed(1), c:+(it.food.c*it.mult).toFixed(1), f:+(it.food.f*it.mult).toFixed(1)}));
  if(window.cloud && cloud.ready()) S.meals.slice(-scanItems.length).forEach(m=>cloud.mark('meals', m.ts));
  save(); closeModal('scanModal'); haptic([0,30,40,30]); renderNutrition(); toast('Meal logged 🍽️');
}
// ----- Barcode scan — live camera decode + Open Food Facts lookup (~3M products) -----
let barcodeProduct=null, bcServings=1, bcBusy=false;
function openBarcode(){ scanView='barcode'; barcodeProduct=null; bcServings=1; bcBusy=false; renderScanSheet(); openModal('scanModal'); startBarcodeCam(); }
async function startBarcodeCam(){
  const v=document.getElementById('bcVideo'); if(!v) return;
  const res=await Scanner.start(v, onBarcodeDetected);
  if(!res.ok){
    const st=document.getElementById('bcStatus'), fb=document.getElementById('bcFallback');
    if(st) st.textContent = res.reason==='insecure' ? 'Camera needs the secure app address — use the installed app or the https link'
      : res.reason==='denied' ? 'Camera blocked — allow camera access for ASCEND in your browser settings'
      : 'No camera on this device — type the barcode digits instead';
    if(fb) fb.style.display='block';
  }
}
function bcSetStatus(msg){ const st=document.getElementById('bcStatus'); if(st) st.innerHTML=msg; }
// Open Food Facts: per-serving macros when the label has them, else per-100g.
async function lookupBarcode(code){
  const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,image_small_url,nutriments`);
  if(!r.ok) return null;
  const j=await r.json(); if(j.status!==1||!j.product) return null;
  const p=j.product, n=p.nutriments||{};
  const perServ=n['energy-kcal_serving']!=null;
  const g=k=>{ const v=perServ?n[k+'_serving']:n[k+'_100g']; return v!=null?+(+v).toFixed(1):0; };
  const kcal=Math.round(perServ?n['energy-kcal_serving']:(n['energy-kcal_100g']||0));
  if(!kcal && !n['proteins_100g'] && !n['proteins_serving']) return null;   // listed but no nutrition data
  return { code, brand:((p.brands||'').split(',')[0]||'').trim(), name:p.product_name||'Unnamed product',
    serving:perServ?(p.serving_size||'1 serving'):'100g', kcal, p:g('proteins'), c:g('carbohydrates'), f:g('fat'),
    emoji:'🍽️', photo:p.image_small_url||null };
}
async function onBarcodeDetected(code){
  code=(code||'').replace(/\D/g,''); if(!code) return;
  if(bcBusy || scanView!=='barcode') return; bcBusy=true;
  haptic(15); bcSetStatus('Found barcode '+code+' — looking it up…');
  try{
    const pr=await lookupBarcode(code);
    if(scanView!=='barcode'){ bcBusy=false; return; }
    if(pr){ Scanner.stop(); barcodeProduct=pr; scanView='product'; haptic([0,30,40,30]); renderScanSheet(); }
    else bcSetStatus(`Barcode ${code} isn't in the food database — try another side of the pack, or <b style="color:var(--accent2);cursor:pointer;" onclick="bcManualFood()">add the food manually</b>`);
  }catch(e){ bcSetStatus('No connection — barcode lookup needs internet'); }
  setTimeout(()=>{ bcBusy=false; }, 1400);
}
function bcManualFood(){ Scanner.stop(); scanPhoto=null; scanItems=[]; scanEditIdx=-2; scanQuery=''; scanView='pickfood'; renderScanSheet(); }
function bcStep(d){ bcServings=Math.max(1, bcServings+d); renderScanSheet(); }
function logBarcode(){ const pr=barcodeProduct; if(!pr) return; const day=new Date().toDateString(); S.meals=S.meals||[];
  S.meals.push({day, ts:Date.now(), name:pr.name, emoji:pr.emoji, serving:pr.serving, mult:bcServings,
    kcal:Math.round(pr.kcal*bcServings), p:+(pr.p*bcServings).toFixed(1), c:+(pr.c*bcServings).toFixed(1), f:+(pr.f*bcServings).toFixed(1)});
  if(window.cloud && cloud.ready()) cloud.mark('meals', S.meals[S.meals.length-1].ts);
  save(); closeModal('scanModal'); haptic([0,30,40,30]); renderNutrition(); toast('Logged '+pr.name); }
// ----- Manual entry — type exactly what you ate, with your own macros -----
function openManualMeal(){ scanView='manual'; renderScanSheet(); openModal('scanModal'); setTimeout(()=>{ const n=document.getElementById('mfName'); if(n) n.focus(); },40); }
function logManualMeal(){
  const g=id=>document.getElementById(id);
  const name=(g('mfName').value||'').trim();
  if(!name){ toast('Name your meal'); return; }
  const p=+g('mfP').value||0, c=+g('mfC').value||0, f=+g('mfF').value||0;
  let kcal=Math.round(+g('mfKcal').value||0);
  if(!kcal && (p||c||f)) kcal=Math.round(p*4 + c*4 + f*9);   // fill calories from macros if left blank
  if(!kcal && !p && !c && !f){ toast('Add calories or macros'); return; }
  const serving=(g('mfServing').value||'').trim()||'1 serving';
  const day=new Date().toDateString(); S.meals=S.meals||[];
  const ts=Date.now();
  S.meals.push({day, ts, name, emoji:'🍽️', serving, mult:1, kcal, p:+p.toFixed(1), c:+c.toFixed(1), f:+f.toFixed(1)});
  if(window.cloud && cloud.ready()) cloud.mark('meals', ts);
  save(); closeModal('scanModal'); haptic([0,30,40,30]); renderNutrition(); toast('Meal logged 🍽️');
}
function renderScanSheet(){
  const el=document.getElementById('scanSheet');
  if(scanView==='manual'){
    el.innerHTML=`<div class="grab"></div><h2 style="margin:0 0 4px;">Type your meal</h2>
      <p class="sub">Enter exactly what you had and its macros. Leave calories blank to auto-fill from protein / carbs / fat.</p>
      <label class="f">What did you eat?</label>
      <input id="mfName" placeholder="e.g. Mum's chicken curry" style="margin-bottom:10px;">
      <label class="f">Serving <span class="muted">(optional)</span></label>
      <input id="mfServing" placeholder="e.g. 1 bowl, 300g" style="margin-bottom:10px;">
      <label class="f">Calories <span class="muted">(optional)</span></label>
      <input id="mfKcal" type="number" inputmode="numeric" placeholder="kcal" style="margin-bottom:10px;">
      <div class="row" style="gap:10px;align-items:flex-start;">
        <div class="grow"><label class="f">Protein (g)</label><input id="mfP" type="number" inputmode="decimal" placeholder="0"></div>
        <div class="grow"><label class="f">Carbs (g)</label><input id="mfC" type="number" inputmode="decimal" placeholder="0"></div>
        <div class="grow"><label class="f">Fat (g)</label><input id="mfF" type="number" inputmode="decimal" placeholder="0"></div>
      </div>
      <button class="btn good" style="margin-top:16px;" onclick="logManualMeal()">Log meal</button>
      <button class="btn ghost" style="margin-top:8px;" onclick="closeModal('scanModal')">Cancel</button>`; return;
  }
  if(scanView==='barcode'){
    el.innerHTML=`<div class="grab"></div><h2 style="margin:0 0 12px;">Scan a barcode</h2>
      <div class="bcview">
        <video id="bcVideo" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video>
        <div class="bcframe" style="z-index:2;">
        <span class="bccorner" style="top:0;left:0;border-right:none;border-bottom:none;"></span>
        <span class="bccorner" style="top:0;right:0;border-left:none;border-bottom:none;"></span>
        <span class="bccorner" style="bottom:0;left:0;border-right:none;border-top:none;"></span>
        <span class="bccorner" style="bottom:0;right:0;border-left:none;border-top:none;"></span>
        <div class="bcline"></div>
      </div></div>
      <div class="tiny muted" id="bcStatus" style="text-align:center;margin-top:12px;line-height:1.5;">${icon('camera',14)} Point at the barcode on the packaging…</div>
      <div id="bcFallback" style="display:none;margin-top:10px;">
        <input id="bcManual" inputmode="numeric" placeholder="Type the barcode number" style="margin-bottom:8px;" onkeydown="if(event.key==='Enter')onBarcodeDetected(this.value)">
        <button class="btn ghost sm" style="width:100%;" onclick="onBarcodeDetected(document.getElementById('bcManual').value)">Look up</button>
      </div>
      <button class="btn ghost" style="margin-top:12px;" onclick="closeModal('scanModal')">Cancel</button>`; return;
  }
  if(scanView==='product'){
    const pr=barcodeProduct, mk=v=>Math.round(v*bcServings);
    el.innerHTML=`<div class="grab"></div>
      <div class="row sb" style="margin-bottom:4px;"><h2 style="margin:0;">Product found</h2><span class="conf">✓ label data</span></div>
      <div class="tiny muted" style="margin-bottom:12px;">Open Food Facts · barcode ${pr.code}</div>
      <div class="fooditem" style="margin-bottom:14px;">
        ${pr.photo?`<img src="${pr.photo}" style="width:46px;height:46px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#fff;">`:`<div style="font-size:27px;">${pr.emoji}</div>`}
        <div class="grow">${pr.brand?`<div class="tiny" style="color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.4px;">${escapeAttr(pr.brand)}</div>`:''}
          <div style="font-weight:700;">${escapeAttr(pr.name)}</div><div class="tiny muted">${escapeAttr(pr.serving)} per serving · ${pr.kcal} kcal</div></div>
      </div>
      <label class="f">Servings</label>
      <div class="row" style="gap:12px;margin-bottom:14px;"><div class="stepper"><button onclick="bcStep(-1)">−</button><div class="n">${bcServings}</div><button onclick="bcStep(1)">＋</button></div>
        <div class="tiny muted grow">${pr.serving} × ${bcServings}</div></div>
      <div class="card flat" style="padding:13px 15px;margin-bottom:12px;">
        <div class="row sb"><div style="font-weight:800;">Total</div><div style="font-weight:800;">${mk(pr.kcal)} kcal</div></div>
        <div class="tiny muted" style="margin-top:4px;">P ${mk(pr.p)}g · C ${mk(pr.c)}g · F ${mk(pr.f)}g</div>
      </div>
      <button class="btn good" onclick="logBarcode()">Log to diary</button>
      <button class="btn ghost" style="margin-top:8px;" onclick="openBarcode()">Scan another</button>`; return;
  }
  if(scanView==='photo'){
    el.innerHTML=`<div class="grab"></div><h2 style="margin:0 0 12px;">Scan a meal</h2>
      <div class="bcview" style="height:260px;">
        <video id="mealVideo" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video>
        <div class="tiny muted" id="mealCamStatus" style="position:relative;z-index:2;text-align:center;padding:0 18px;"></div>
      </div>
      <button class="btn" style="margin-top:12px;" onclick="snapMeal()">${icon('camera',17)} Snap the plate</button>
      <label class="btn ghost sm" style="display:block;text-align:center;cursor:pointer;margin-top:8px;">Upload a photo instead
        <input type="file" accept="image/*" style="display:none;" onchange="pickScanPhoto(this)"></label>
      <button class="btn ghost" style="margin-top:8px;" onclick="closeModal('scanModal')">Cancel</button>`; return;
  }
  if(scanView==='pickfood'){
    el.innerHTML=`<div class="grab"></div><h2 style="margin:0 0 4px;">${scanEditIdx===-2?'Add a food':'Correct the food'}</h2>
      <p class="sub">Pick the exact item — e.g. grilled vs fried changes the macros.</p>
      <input id="foodSearch" placeholder="Search foods…" oninput="filterFoods(this.value)" style="margin-bottom:10px;">
      <div id="foodList"></div>
      <button class="btn ghost" style="margin-top:6px;" onclick="scanView='results';renderScanSheet();">Back</button>`;
    filterFoods(scanQuery); setTimeout(()=>{ const s=document.getElementById('foodSearch'); if(s) s.focus(); },30); return;
  }
  const t=scanTotals();
  el.innerHTML=`<div class="grab"></div>
    <div class="row sb" style="margin-bottom:8px;"><h2 style="margin:0;">Your meal</h2>${scanPhoto?`<img src="${scanPhoto}" style="width:46px;height:46px;border-radius:10px;object-fit:cover;">`:''}</div>
    <div class="tiny muted" style="margin-bottom:12px;">${scanItems.length?'Tap ✎ to correct a food, or ×N to adjust the portion.':'Add each food on the plate, or let AI read it.'}</div>
    ${scanPhoto && window.cloud && cloud.ready() ? `<button class="btn ghost sm" id="aiIdBtn" style="margin:0 0 12px;" onclick="aiIdentifyMeal()">✨ Identify foods with AI</button>` : ''}
    ${scanItems.map((it,i)=>{ const m=it.food;
      return `<div class="fooditem">
        <div style="font-size:25px;">${m.emoji}</div>
        <div class="grow">
          <div class="row sb"><div style="font-weight:700;">${m.name}</div>${it.conf<100?`<span class="conf ${it.conf<80?'low':''}">${it.conf}%</span>`:'<span class="conf">✓</span>'}</div>
          <div class="tiny muted" style="margin:3px 0 6px;">${m.serving} · ×${it.mult} · ${Math.round(m.kcal*it.mult)} kcal</div>
          <div><span class="pchip"><span class="pdot" style="background:#5ad1a0;"></span>P ${Math.round(m.p*it.mult)}</span><span class="pchip"><span class="pdot" style="background:#ffb84d;"></span>C ${Math.round(m.c*it.mult)}</span><span class="pchip"><span class="pdot" style="background:#ff7a9c;"></span>F ${Math.round(m.f*it.mult)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
          <button class="portbtn" onclick="editScanItem(${i})">✎</button>
          <button class="portbtn" onclick="cyclePortion(${i})">×${it.mult}</button>
          <button class="portbtn" style="color:var(--bad);" onclick="removeScanItem(${i})">✕</button>
        </div></div>`;
    }).join('')}
    <button class="btn ghost sm" style="width:100%;margin-bottom:12px;" onclick="addScanItem()">＋ Add another food</button>
    <div class="card flat" style="padding:13px 15px;margin-bottom:12px;">
      <div class="row sb"><div style="font-weight:800;">Meal total</div><div style="font-weight:800;">${Math.round(t.kcal)} kcal</div></div>
      <div class="tiny muted" style="margin-top:4px;">P ${Math.round(t.p)}g · C ${Math.round(t.c)}g · F ${Math.round(t.f)}g</div>
    </div>
    <button class="btn good" onclick="logMeal()">Log meal</button>
    <button class="btn ghost" style="margin-top:8px;" onclick="closeModal('scanModal')">Cancel</button>`;
}

