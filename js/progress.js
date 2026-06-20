// ---------- XP / Level / Streak ----------
function sessionXP(ses){ let sets=0,vol=0; for(const ex of ses.exercises){ sets+=ex.sets.length; for(const s of ex.sets) vol+=(+s.weight||0)*(+s.reps||0);} return Math.round((50+sets*10+Math.round(vol/100))*(ses.xpMult||1)); }
function totalXP(){ return S.sessions.reduce((a,s)=>a+sessionXP(s),0); }
// ---------- Shard earning ----------
// Time in the gym (1 per 5 min, capped at 2h) + 2 per set + 25 per PR, ×1.1 while on a streak.
function countPRs(ses){
  let n=0;
  for(const ex of ses.exercises){
    const top=Math.max(0,...ex.sets.map(s=>+s.weight||0));
    let prev=0;
    for(const s2 of S.sessions){ if(s2===ses||s2.start>=ses.start) continue; const e2=s2.exercises.find(e=>e.id===ex.id); if(e2) for(const st of e2.sets) prev=Math.max(prev,+st.weight||0); }
    if(prev>0 && top>prev) n++;          // beating an existing record counts; a first-time lift just sets the baseline
  }
  return n;
}
// The single most impressive PR in a session (by lift score), for the feed auto-post.
function prHeadline(ses){
  let best=null;
  for(const ex of ses.exercises){
    const top=Math.max(0,...ex.sets.map(s=>+s.weight||0)); if(!top) continue;
    let prev=0;
    for(const s2 of S.sessions){ if(s2===ses||s2.start>=ses.start) continue; const e2=s2.exercises.find(e=>e.id===ex.id); if(e2) for(const st of e2.sets) prev=Math.max(prev,+st.weight||0); }
    if(prev>0 && top>prev){
      const reps=Math.max(1,...ex.sets.filter(s=>+s.weight===top).map(s=>+s.reps||1));
      const score=liftScore(ex.id, top);
      if(!best||score>best.score) best={lift:EXMAP[ex.id].name, wt:top, reps, units:S.units, score};
    }
  }
  return best;
}
function shardsForSession(ses, prCount){
  const mins=Math.min(120, Math.max(0, Math.round(((ses.end||Date.now())-ses.start)/60000)));
  const sets=ses.exercises.reduce((a,e)=>a+e.sets.length,0);
  const base=Math.floor(mins/5) + sets*2 + (prCount||0)*25;
  const mult=streakInfo()>=2 ? 1.1 : 1;
  return {gain:Math.round(base*mult), mult, mins, sets};
}
function levelInfo(xp){ let lvl=1,need=300,rem=xp; while(rem>=need){ rem-=need; lvl++; need=Math.round(need*1.12);} return {level:lvl,into:rem,need,pct:rem/need}; }
// ---------- Streak engine ----------
// Streak counts CALENDAR days since the chain started (rest days included, Liftoff-style).
// It survives as long as you never go more than STREAK_GRACE days without logging an exercise.
// Freezes (inventory) auto-spend to forgive extra missed days; revives restore a lost chain.
const DAY=864e5, STREAK_GRACE=3;
function day0(t){ const d=new Date(t); d.setHours(0,0,0,0); return d.getTime(); }
function trainedDayList(){ return [...new Set(S.sessions.map(s=>day0(s.start)))].sort((a,b)=>a-b); }
function deriveStreak(){            // migration: rebuild the latest chain from history; reconcile decides alive/frozen/lost
  const days=trainedDayList(); S.stk=null; S.stkLost=S.stkLost||null;
  if(!days.length) return;
  let start=days[days.length-1];
  for(let i=days.length-1;i>0;i--){ if(days[i]-days[i-1]<=STREAK_GRACE*DAY) start=days[i-1]; else break; }
  S.stk={start, last:days[days.length-1], frozen:[]};
}
function reconcileStreak(){
  if(S.stk===undefined) deriveStreak();
  if(!S.stk) return;
  const today=day0(Date.now());
  let gap=Math.round((today-S.stk.last)/DAY), used=0;
  while(gap>STREAK_GRACE && (S.inv.freeze||0)>0){            // each freeze forgives one missed day
    S.inv.freeze--; S.stk.frozen.push(S.stk.last+DAY); S.stk.last+=DAY; gap--; used++;
  }
  if(used){ save(); toast('🧊 Streak Freeze used — streak protected'); }
  if(gap>STREAK_GRACE){
    S.stkLost={count:Math.round((S.stk.last+STREAK_GRACE*DAY-S.stk.start)/DAY)+1, day:today};
    S.stk=null; save();
    toast('💔 Streak lost — revive it from your Inventory');
  }
}
function streakCount(){ return S.stk ? Math.round((day0(Date.now())-S.stk.start)/DAY)+1 : 0; }
function streakInfo(){ reconcileStreak(); return streakCount(); }
function streakGap(){ return S.stk ? Math.round((day0(Date.now())-S.stk.last)/DAY) : 0; }
function bumpStreak(){              // call whenever a session is logged
  reconcileStreak();
  const today=day0(Date.now());
  if(S.stk) S.stk.last=today;
  else { S.stk={start:today,last:today,frozen:[]}; S.stkLost=null; }   // training again starts fresh — the old loss expires unrevived
}
function lastPerf(exId, beforeStart){
  const past=S.sessions.filter(s=>!beforeStart||s.start<beforeStart).sort((a,b)=>b.start-a.start);
  for(const ses of past){ const ex=ses.exercises.find(e=>e.id===exId); if(ex&&ex.sets.length) return ex.sets; }
  return null;
}

