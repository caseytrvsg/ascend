// ---------- Scoring (strength per muscle group, relative to bodyweight; no sex factor) ----------
function e1rm(weight, reps){ return reps<=1 ? weight : weight*(1+reps/30); }  // (kept for reference; rank no longer uses it)
// Rank is the HEAVIEST ACTUAL WEIGHT pushed per exercise (reps don't affect rank).
// `verified` = the session where that top weight was hit had a proof photo of the loaded bar.
// Strength rank = your heaviest logged weight per exercise (relative to bodyweight). Verified
// head-to-head competition lives in the Compete tab.
function bestLiftsFrom(sessions){
  const best={};
  for(const ses of sessions) for(const ex of ses.exercises){
    let topW=0; for(const set of ex.sets){ const w=+set.weight; if(w>topW) topW=w; }
    if(!topW) continue;
    if(!best[ex.id] || topW>best[ex.id].w) best[ex.id]={w:topW};
  }
  return best;
}
function bestLifts(){ return bestLiftsFrom(S.sessions); }
// liftScore = % of "elite" for a lift (100 ≈ Ascended-level weight÷bodyweight). No sex factor.
function liftScore(exId, weight){
  const ex=EXMAP[exId]; if(!ex||!S.bw||!weight) return 0;
  return Math.max(0, Math.min(130, (weight/S.bw)/ex.std*100));
}
const liftSR = pct => pct*8;            // 100% -> 800 SR (the Ascended floor)
// A muscle group's SR = the average of your TOP 3 logged exercises in that group (each scored by its
// heaviest weight relative to bodyweight). Depth matters, but light accessories don't tank the rank.
function groupSRfrom(best, group){
  const scores=[];
  for(const id in best){ const ex=EXMAP[id]; if(ex&&ex.group===group) scores.push(liftScore(id,best[id].w)); }
  if(!scores.length) return null;
  scores.sort((a,b)=>b-a);
  const top=scores.slice(0,3);
  return liftSR(top.reduce((a,b)=>a+b,0)/top.length);
}
function groupSR(group){ return groupSRfrom(bestLifts(), group); }
// Overall SR = average of all 6 muscle-group SRs (untrained groups count as 0).
function overallSRfrom(sessions){ const best=bestLiftsFrom(sessions); let sum=0; GROUPS.forEach(g=>{ const v=groupSRfrom(best,g); sum+=v||0; }); return sum/GROUPS.length; }
function overallSR(){ return overallSRfrom(S.sessions); }
function rankIndexFor(sr){ return Math.max(0, Math.min(ASC, Math.floor(sr/SR_PER_RANK))); }
function rankFor(sr){ return RANKS[rankIndexFor(sr)]; }
function nextRank(sr){ const i=rankIndexFor(sr); return i<ASC ? RANKS[i+1] : null; }
// Returns {rank, division(1-3|null), sr(within-rank, or total for Ascended), toNext, ascended, label}
function rankDetail(sr){
  const i=rankIndexFor(sr), rank=RANKS[i];
  if(i===ASC){ const r=Math.round(sr); return {rank, division:null, sr:r, toNext:0, ascended:true, label:`${rank.name} · ${r} SR`}; }
  const local=sr-i*SR_PER_RANK, division=Math.max(1,Math.min(3,Math.floor(local/(SR_PER_RANK/3))+1));
  return {rank, division, sr:Math.round(local), toNext:Math.round(SR_PER_RANK-local), ascended:false, label:`${rank.name} ${division} · ${Math.round(local)} SR`};
}

