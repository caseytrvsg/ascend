// ---------- Rank ladder ----------
const RANKS = [
  {name:'Paperweight',       color:'#8a5a2b'},
  {name:'Featherweight',     color:'#5d5d68'},
  {name:'Lightweight',       color:'#c5cdd6'},
  {name:'Welterweight',      color:'#ffc23a'},
  {name:'Middleweight',      color:'#45d6c0'},
  {name:'Heavyweight',       color:'#6f8fb0'},
  {name:'Champion',          color:'#b06bff'},
  {name:'Olympian',          color:'#ff3b6b'},
  {name:'Ascended',          color:'#fff0a8'},
];
RANKS.forEach((r,i)=>r.min=i*100);      // each rank spans 100 SR
const SR_PER_RANK=100, ASC=RANKS.length-1;
const DIV_LABELS=['1','2','3'];          // division 1 (lowest) -> 3 (highest)

// Original game-style emblem. Optional `division` (1-3) draws chevrons; Ascended gets rays.
// Swap in your own art: set USE_IMG=true and add icons/<rankname>.png.
const USE_IMG=false;
// Mix a hex colour toward white (1) or black (0) by t — gives metallic shading per rank.
function mixHex(hex, toWhite, t){
  const a=parseInt(hex.slice(1),16), r=(a>>16)&255, g=(a>>8)&255, b=a&255, tv=toWhite?255:0, m=v=>Math.round(v+(tv-v)*t);
  return '#'+[m(r),m(g),m(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
// A real game-style rank crest: metallic frame + faceted gem + escalating wings + glow.
// Detailed at larger sizes; a clean compact crest at small sizes (leaderboard/feed).
function rankEmblem(rk, px, division){
  if(USE_IMG) return `<img src="icons/${rk.name.toLowerCase()}.png" width="${px}" height="${px}" style="object-fit:contain;display:block;" alt="${rk.name}">`;
  const c=rk.color, tier=RANKS.indexOf(rk), uid=tier+'_'+px, big=px>=44;
  const light=mixHex(c,1,.5), pale=mixHex(c,1,.78), dark=mixHex(c,0,.42), deep=mixHex(c,0,.6);
  const CREST='M50 9 L79 24 L75 57 L50 88 L25 57 L21 24 Z';      // outer crest
  const INNER='M50 18 L71 29 L68 53 L50 78 L32 53 L29 29 Z';     // inner bevel
  const GEM='M50 33 L64 46 L50 67 L36 46 Z';                     // faceted gem
  // Layered filled wings, growing with tier (big sizes only).
  let wings='';
  if(big && tier>=2){
    const nf=Math.min(4, tier-1), reach=[0,0,16,20,24,28,31,34,36][tier];
    const wing=dir=>{ let p=''; const ax=50+dir*22, ay=30;
      for(let i=0;i<nf;i++){ const len=reach-i*4.5, y=ay+i*7, ty=y-9-i*1.2, ex=ax+dir*len;
        p+=`<path d="M${ax} ${y} Q ${ax+dir*len*0.55} ${(y+ty)/2-3} ${ex} ${ty} Q ${ax+dir*len*0.5} ${y+3} ${ax} ${y+5} Z" fill="url(#wg${uid})" stroke="${deep}" stroke-width="0.6" opacity="${(0.96-i*0.07).toFixed(2)}"/>`; }
      return p; };
    wings=wing(1)+wing(-1);
  }
  // Rays + crown for the top two tiers.
  let rays='',crown='';
  if(big && tier>=7){
    const outer=tier===8?52:49, w=tier===8?2.6:2, op=tier===8?0.95:0.65;
    for(let a=0;a<16;a++){ const ang=(a*22.5-90)*Math.PI/180,x1=50+Math.cos(ang)*44,y1=50+Math.sin(ang)*44,x2=50+Math.cos(ang)*outer,y2=50+Math.sin(ang)*outer;
      rays+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${pale}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`; }
    crown=`<path d="M40 9 L43 0 L47 5 L50 -4 L53 5 L57 0 L60 9 Z" fill="url(#fr${uid})" stroke="${deep}" stroke-width="1" stroke-linejoin="round"/>
      <circle cx="50" cy="-4" r="2.2" fill="${pale}"/><circle cx="43" cy="0" r="1.4" fill="${pale}"/><circle cx="57" cy="0" r="1.4" fill="${pale}"/>`;
  }
  // Division base tab (big) or pips text carries it.
  let tab='';
  const n=division||0;
  if(big && n){ const tabC=n===1?dark:n===2?light:pale; tab=`<path d="M${50-7*1} 84 L50 84 L50 96 L${50-9} 90 Z M${50+7*1} 84 L50 84 L50 96 L${50+9} 90 Z" fill="${tabC}" stroke="${deep}" stroke-width="0.8" stroke-linejoin="round"/>
    ${[...Array(n)].map((_,i)=>`<circle cx="${50+(i-(n-1)/2)*7}" cy="89" r="1.7" fill="#fff" opacity=".9"/>`).join('')}`; }
  const glow = big ? `<ellipse cx="50" cy="48" rx="46" ry="46" fill="url(#gl${uid})"/>` : '';
  return `<svg width="${px}" height="${px}" viewBox="0 0 100 100" style="display:block;overflow:visible;">
    <defs>
      <linearGradient id="fr${uid}" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="gm${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pale}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="wg${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pale}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <radialGradient id="gl${uid}" cx="50%" cy="48%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
    </defs>
    ${glow}${rays}${wings}
    <path d="${CREST}" fill="url(#fr${uid})" stroke="${deep}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${CREST}" fill="none" stroke="${pale}" stroke-width="1" stroke-linejoin="round" opacity=".6" transform="scale(.93)" transform-origin="50 48"/>
    <path d="${INNER}" fill="none" stroke="${deep}" stroke-width="1.4" stroke-linejoin="round" opacity=".7"/>
    <path d="${GEM}" fill="url(#gm${uid})" stroke="${deep}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M50 33 L50 67 M36 46 L64 46" stroke="${deep}" stroke-width="0.7" opacity=".5"/>
    <path d="M50 33 L57 46 L50 50 L43 46 Z" fill="#fff" opacity=".28"/>
    <path d="M50 33 L43 46 L50 50 Z" fill="#fff" opacity=".12"/>
    ${tab}${crown}</svg>`;
}

