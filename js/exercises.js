/* ============================================================
   ASCEND — strength-ranked workout tracker (prototype v0.2)
   Original design & code. Single-file, localStorage-backed.
   ============================================================ */

// ---------- Exercise library ----------
// std = approx "elite" 1RM-to-bodyweight ratio (advanced male) → normalizes score 0–100.
// w   = weight in overall score (compounds matter most). Add niche lifts by copying a row.
const EXERCISES = [
  // Chest
  {id:'bench',     name:'Barbell Bench Press',   icon:'🏋️', group:'Chest', std:1.5,  w:1.0},
  {id:'inclineBb', name:'Incline Barbell Press', icon:'📈', group:'Chest', std:1.25, w:0.8},
  {id:'declineBb', name:'Decline Bench Press',   icon:'↘️', group:'Chest', std:1.55, w:0.6},
  {id:'benchDb',   name:'Dumbbell Bench Press',  icon:'🛋️', group:'Chest', std:0.6,  w:0.6},
  {id:'inclineDb', name:'Incline Dumbbell Press',icon:'💪', group:'Chest', std:0.5,  w:0.6},
  {id:'chestPress',name:'Chest Press (Machine)', icon:'⚙️', group:'Chest', std:1.4,  w:0.5},
  {id:'flyDb',     name:'Dumbbell Fly',          icon:'🦋', group:'Chest', std:0.3,  w:0.3},
  {id:'flyCable',  name:'Cable Fly',             icon:'🪢', group:'Chest', std:0.35, w:0.3},
  {id:'pecdeck',   name:'Pec Deck',              icon:'🦋', group:'Chest', std:0.6,  w:0.3},
  {id:'dip',       name:'Weighted Dip',          icon:'⬇️', group:'Chest', std:0.9,  w:0.6},
  {id:'pushup',    name:'Push-up',               icon:'🤸', group:'Chest', std:0.45, w:0.3},
  // Back
  {id:'dead',      name:'Deadlift',              icon:'🪨', group:'Back',  std:2.6,  w:1.0},
  {id:'sumo',      name:'Sumo Deadlift',         icon:'🪨', group:'Back',  std:2.6,  w:0.8},
  {id:'rackpull',  name:'Rack Pull',             icon:'🟰', group:'Back',  std:3.0,  w:0.5},
  {id:'rowBb',     name:'Barbell Row',           icon:'🚣', group:'Back',  std:1.4,  w:0.7},
  {id:'pendlay',   name:'Pendlay Row',           icon:'🚣', group:'Back',  std:1.35, w:0.6},
  {id:'rowDb',     name:'Dumbbell Row',          icon:'🏋️', group:'Back',  std:0.6,  w:0.6},
  {id:'tbar',      name:'T-Bar Row',             icon:'🅣', group:'Back',  std:1.3,  w:0.6},
  {id:'cablerow',  name:'Seated Cable Row',      icon:'🪢', group:'Back',  std:1.3,  w:0.6},
  {id:'latpull',   name:'Lat Pulldown',          icon:'⬇️', group:'Back',  std:1.2,  w:0.6},
  {id:'pullup',    name:'Pull-up',               icon:'🧗', group:'Back',  std:0.65, w:0.6},
  {id:'chinup',    name:'Chin-up',               icon:'🧗', group:'Back',  std:0.70, w:0.5},
  {id:'sapulldown',name:'Straight-Arm Pulldown', icon:'🪢', group:'Back',  std:0.45, w:0.3},
  {id:'facepull',  name:'Face Pull',             icon:'🪢', group:'Back',  std:0.4,  w:0.3},
  {id:'shrug',     name:'Barbell Shrug',         icon:'🤷', group:'Back',  std:1.8,  w:0.4},
  // Shoulders
  {id:'ohp',       name:'Overhead Press',        icon:'🏋️', group:'Shoulders', std:1.0,  w:0.8},
  {id:'pressDb',   name:'Seated Dumbbell Press', icon:'💪', group:'Shoulders', std:0.45, w:0.6},
  {id:'arnold',    name:'Arnold Press',          icon:'💪', group:'Shoulders', std:0.40, w:0.4},
  {id:'latraise',  name:'Lateral Raise',         icon:'🔺', group:'Shoulders', std:0.20, w:0.4},
  {id:'frontraise',name:'Front Raise',           icon:'🔺', group:'Shoulders', std:0.22, w:0.3},
  {id:'reardelt',  name:'Rear Delt Fly',         icon:'🦋', group:'Shoulders', std:0.20, w:0.3},
  {id:'uprightrow',name:'Upright Row',           icon:'⬆️', group:'Shoulders', std:0.6,  w:0.4},
  // Legs
  {id:'squat',     name:'Back Squat',            icon:'🦵', group:'Legs',  std:2.1,  w:1.0},
  {id:'front',     name:'Front Squat',           icon:'🦵', group:'Legs',  std:1.6,  w:0.7},
  {id:'legpress',  name:'Leg Press',             icon:'🦿', group:'Legs',  std:3.5,  w:0.6},
  {id:'hack',      name:'Hack Squat',            icon:'🦿', group:'Legs',  std:2.0,  w:0.5},
  {id:'rdl',       name:'Romanian Deadlift',     icon:'🪨', group:'Legs',  std:1.9,  w:0.7},
  {id:'goblet',    name:'Goblet Squat',          icon:'🏺', group:'Legs',  std:0.8,  w:0.4},
  {id:'bulgarian', name:'Bulgarian Split Squat', icon:'🦵', group:'Legs',  std:0.7,  w:0.5},
  {id:'lunge',     name:'Walking Lunge',         icon:'🚶', group:'Legs',  std:0.8,  w:0.4},
  {id:'legext',    name:'Leg Extension',         icon:'🦿', group:'Legs',  std:1.0,  w:0.5},
  {id:'legcurl',   name:'Leg Curl',              icon:'🦿', group:'Legs',  std:0.8,  w:0.5},
  {id:'hip',       name:'Hip Thrust',            icon:'🍑', group:'Legs',  std:2.8,  w:0.5},
  {id:'calf',      name:'Calf Raise',            icon:'🦶', group:'Legs',  std:2.0,  w:0.4},
  // Arms
  {id:'curlBb',    name:'Barbell Curl',          icon:'💪', group:'Arms',  std:0.75, w:0.4},
  {id:'curlDb',    name:'Dumbbell Curl',         icon:'💪', group:'Arms',  std:0.30, w:0.4},
  {id:'hammer',    name:'Hammer Curl',           icon:'🔨', group:'Arms',  std:0.32, w:0.4},
  {id:'preacher',  name:'Preacher Curl',         icon:'💪', group:'Arms',  std:0.55, w:0.4},
  {id:'cablecurl', name:'Cable Curl',            icon:'🪢', group:'Arms',  std:0.50, w:0.3},
  {id:'cgbench',   name:'Close-Grip Bench',      icon:'🏋️', group:'Arms',  std:1.3,  w:0.6},
  {id:'pushdown',  name:'Tricep Pushdown',       icon:'🪢', group:'Arms',  std:0.70, w:0.4},
  {id:'skull',     name:'Skullcrusher',          icon:'💀', group:'Arms',  std:0.60, w:0.4},
  {id:'oht',       name:'Overhead Tricep Ext',   icon:'💪', group:'Arms',  std:0.50, w:0.3},
  // Core
  {id:'hangraise', name:'Hanging Leg Raise',     icon:'🧷', group:'Core',  std:0.30, w:0.3},
  {id:'cablecrunch',name:'Cable Crunch',         icon:'🪢', group:'Core',  std:0.80, w:0.3},
  {id:'abwheel',   name:'Ab Wheel Rollout',      icon:'🎡', group:'Core',  std:0.25, w:0.2},
  {id:'russian',   name:'Russian Twist',         icon:'🌀', group:'Core',  std:0.30, w:0.2},
];
const GROUPS = ['Chest','Back','Shoulders','Legs','Arms','Core'];
const EXMAP = Object.fromEntries(EXERCISES.map(e=>[e.id,e]));
// Per-exercise muscle map: primary group (full) + secondary groups (partial) → intensity 0..1.
function exMuscleMap(id){
  const m={}; GROUPS.forEach(g=>m[g]=0); const ex=EXMAP[id]; if(!ex) return m;
  m[ex.group]=1;
  const sec=(typeof ACT_SEC!=='undefined'&&ACT_SEC[id])||{};
  for(const g in sec) m[g]=Math.max(m[g]||0, sec[g]);
  return m;
}
// Exercise "demo": the anatomy figure with the worked muscles highlighted (front, or back for back work).
function exDemoBody(id, h){
  const A=window.ANATOMY; if(!A) return `<span style="font-size:20px;">${(EXMAP[id]||{}).icon||''}</span>`;
  const side = (EXMAP[id]||{}).group==='Back' ? 'back' : 'front';
  const cf = actColorFn(exMuscleMap(id));
  let m=''; A[side].forEach(p=>{ const g=SLUG2GRP[p.slug], fill=g?cf(g):'#1b1b26';
    [].concat(p.path.left||[],p.path.right||[],p.path.common||[]).forEach(d=>{ m+=`<path d="${d}" fill="${fill}" stroke="#0a0a0f" stroke-width="3" stroke-opacity=".25"/>`; }); });
  return `<svg viewBox="${A.viewBox[side]}" height="${h}" style="display:block;"><path d="${A.outline[side]}" fill="#1b1b26" stroke="#33334a" stroke-width="3"/>${m}</svg>`;
}
// On-demand exercise demo (public-domain photos) — opens inline for users who don't know the lift.
let demoOpen=new Set();
function toggleDemo(id){ demoOpen.has(id)?demoOpen.delete(id):demoOpen.add(id); renderExOptions(); }
function exDemoPhoto(id){
  const f=window.EX_IMG&&window.EX_IMG[id];
  if(!f) return `<div class="tiny muted" style="padding:14px;text-align:center;">No demo available for this one.</div>`;
  const a=f[0], b=f[1]||f[0], st='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
  const animated = b!==a;
  return `<div style="position:relative;height:210px;background:#e9e9ee;margin:10px;border-radius:12px;overflow:hidden;">`
    + `<img src="${a}" loading="lazy" style="${st}">`
    + (animated?`<img src="${b}" loading="lazy" class="exf" style="${st}">`:'')
    + `</div><div class="tiny muted" style="padding:0 12px 11px;text-align:center;">${animated?'Looping demo':'Demonstration'} · public-domain</div>`;
}

