// ---------- TRAIN ----------
function startWorkout(){ if(S.active){ expandFocus(); return; } S.active={start:Date.now(), exercises:[]}; save(); renderTrain(); }
function renderTopbar(){
  const li=levelInfo(totalXP());
  document.getElementById('tbAv').textContent=(S.name||'A').slice(0,1).toUpperCase();
  document.getElementById('tbLvl').textContent='Lv.'+li.level;
  document.getElementById('tbXpFill').style.width=(li.pct*100)+'%';
  document.getElementById('tbStreak').textContent=streakInfo();
  document.getElementById('tbCoins').textContent=(S.shards||0).toLocaleString();
  applyBorder(); applyBanner();
}

