// ---------- Navigation ----------
function go(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.screen===name));
  window.scrollTo(0,0);
  renderTopbar();
  if(name==='rank') renderRank();
  if(name==='feed') renderFeed();
  if(name==='compete'){ renderCompete(); refreshDuels(); }
  if(name==='nutrition') renderNutrition();
  if(name==='profile') renderProfile();
  if(name==='train') renderTrain();
}

