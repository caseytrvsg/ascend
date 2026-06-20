// ---------- Icon system ----------
// One consistent set: stroke icons at 1.9 weight, filled silhouettes where solidity
// reads better (flame, bolt, star, heart). Always currentColor so they tint anywhere.
const ICONS={
  bolt:{f:1,d:'M13 2 5.2 13.2h4.6L8.6 22l8.2-11.6h-4.6z'},
  star:{f:1,d:'M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L2.9 9.4l6.3-.9z'},
  heart:{f:1,d:'M12 20.5C5.2 15.3 3.5 11.8 3.5 8.9 3.5 6.2 5.5 4.2 8 4.2c1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.5 0 4.5 2 4.5 4.7 0 2.9-1.7 6.4-8.5 11.6z'},
  sparkle:{f:1,d:'M12 3.2l1.7 5.1 5.1 1.7-5.1 1.7L12 16.8l-1.7-5.1-5.1-1.7 5.1-1.7zM19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z'},
  calendar:{d:'<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10.5h16M8.5 3.2v4M15.5 3.2v4"/>'},
  users:{d:'<circle cx="9" cy="8.5" r="3.2"/><path d="M3.4 19.6c.4-3 2.7-4.8 5.6-4.8s5.2 1.8 5.6 4.8M16.5 12.2c1.6 0 3.7 1 4.1 3.8"/><path d="M15.5 6.1a2.7 2.7 0 1 1 1 5.2"/>'},
  swords:{d:'M4.5 4.5l10.2 10.2M4.5 4.5V8M4.5 4.5H8M19.5 4.5L9.3 14.7M19.5 4.5V8M19.5 4.5H16M7 14.5l2.5 2.5M17 14.5l-2.5 2.5M6.2 18l-2 2M17.8 18l2 2M8.5 16l-3.5 3.5M15.5 16l3.5 3.5'},
  camera:{d:'<rect x="3.2" y="7" width="17.6" height="13" rx="3"/><path d="M8.8 7l1.3-2.6h3.8L15.2 7"/><circle cx="12" cy="13.2" r="3.5"/>'},
  barcode:{d:'M4 5.5v13M7.6 5.5v13M11 5.5V14M11 17.4v1.1M14.2 5.5v13M17 5.5V14M17 17.4v1.1M20 5.5v13'},
  trophy:{d:'M7 4.5h10v4a5 5 0 0 1-10 0zM7 6H4.3a2.9 2.9 0 0 0 3 3.8M17 6h2.7a2.9 2.9 0 0 1-3 3.8M12 13.5v2.8M9.6 19.8l.6-3.5h3.6l.6 3.5zM8 19.8h8'},
  clipboard:{d:'<rect x="5" y="4.6" width="14" height="16.8" rx="2.4"/><path d="M9.2 4.6V3.2h5.6v1.4M8.6 10h6.8M8.6 13.6h6.8M8.6 17.2h4"/>'},
  bell:{d:'M6.2 16.2v-5.4a5.8 5.8 0 0 1 11.6 0v5.4l1.7 2.5H4.5zM10.1 21a2.1 2.1 0 0 0 3.8 0'},
  palette:{d:'<path d="M12 3.6a8.4 8.4 0 1 0 0 16.8c1.3 0 1.9-.8 1.9-1.7 0-.8-.6-1.2-.6-2 0-1 .8-1.6 1.9-1.6h1.4a4.4 4.4 0 0 0 4.4-4.2C21 6.7 16.9 3.6 12 3.6z"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="12.6" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="16.6" cy="9.6" r="1" fill="currentColor" stroke="none"/>'},
  trash:{d:'M4.6 6.5h14.8M9.6 6V4.4h4.8V6M7.1 6.5l.8 13.1h8.2l.8-13.1M10.1 10.5v5.6M13.9 10.5v5.6'},
  help:{d:'<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8v.4"/><circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none"/>'},
  mail:{d:'<rect x="3.4" y="5.5" width="17.2" height="13" rx="2.2"/><path d="M4.4 7.5L12 13l7.6-5.5"/>'},
  globe:{d:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.3 3.7 5.2 3.7 8.5s-1.2 6.2-3.7 8.5c-2.5-2.3-3.7-5.2-3.7-8.5s1.2-6.2 3.7-8.5z"/>'},
  restore:{d:'M5 8.3A8.2 8.2 0 1 1 3.9 12M5 3.6v4.7h4.7'},
  doc:{d:'M6.4 3.6h7.2L19 9v11.4H6.4zM13 4.2V9.4h5.4M9.4 13.4h5.2M9.4 16.8h5.2'},
  user:{d:'<circle cx="12" cy="8.2" r="3.7"/><path d="M4.6 20c.6-3.5 3.6-5.5 7.4-5.5s6.8 2 7.4 5.5"/>'},
  barbell:{d:'M7.4 8.4v7.2M16.6 8.4v7.2M4.4 10v4M19.6 10v4M7.4 12h9.2M2.2 11.2v1.6M21.8 11.2v1.6'},
  cloud:{d:'M7 18.6a4.6 4.6 0 0 1-.4-9.1A5.6 5.6 0 0 1 17.4 11a3.9 3.9 0 0 1-.8 7.6z'},
  sync:{d:'M4.4 9a8 8 0 0 1 13.9-2.6L20.6 9M20.6 4.4V9H16M19.6 15a8 8 0 0 1-13.9 2.6L3.4 15M3.4 19.6V15H8'},
  signout:{d:'M14 4.4H6.6A1.6 1.6 0 0 0 5 6v12a1.6 1.6 0 0 0 1.6 1.6H14M10.4 12H21M17.6 8.4L21.2 12l-3.6 3.6'},
  snowflake:{d:'M12 3.4v17.2M4.6 7.7l14.8 8.6M19.4 7.7L4.6 16.3M12 6.6l2.1-2.1M12 6.6L9.9 4.5M12 17.4l2.1 2.1M12 17.4l-2.1 2.1M6.7 8.9L3.9 8.1M6.7 15.1l-2.8.8M17.3 8.9l2.8-.8M17.3 15.1l2.8.8'},
  shaker:{d:'M9.2 3.4h5.6M9.8 3.4l.5 2.8h3.4l.5-2.8M8.6 8.6h6.8l-.9 12H9.5zM8.9 12.4h6.2'},
  chart:{d:'M4.5 20.5V4.5M4.5 20.5H20M8.5 16.5v-5M12.5 16.5V8M16.5 16.5v-3.4'},
  pin:{d:'<path d="M12 21.4s6.5-5.7 6.5-10.4a6.5 6.5 0 1 0-13 0c0 4.7 6.5 10.4 6.5 10.4z"/><circle cx="12" cy="10.8" r="2.4"/>'},
  search:{d:'<circle cx="10.8" cy="10.8" r="6.6"/><path d="M15.6 15.6l4.6 4.6"/>'},
  shield:{d:'M12 3l7.5 2.7v4.9c0 4.6-3 7.9-7.5 9.4-4.5-1.5-7.5-4.8-7.5-9.4V5.7z'},
  chat:{d:'M4.6 4.8h14.8a1.6 1.6 0 0 1 1.6 1.6v8.2a1.6 1.6 0 0 1-1.6 1.6H10.2L5.6 20.4v-4.2h-1A1.6 1.6 0 0 1 3 14.6V6.4a1.6 1.6 0 0 1 1.6-1.6z'},
  heartO:{d:'M12 20.5C5.2 15.3 3.5 11.8 3.5 8.9 3.5 6.2 5.5 4.2 8 4.2c1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.5 0 4.5 2 4.5 4.7 0 2.9-1.7 6.4-8.5 11.6z'},
  target:{d:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.7"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>'},
};
// Friendly illustrated empty state — circled icon + title + one-liner.
function emptyState(ic, title, sub){
  return `<div style="text-align:center;padding:26px 14px;">
    <div style="width:64px;height:64px;border-radius:50%;background:var(--card2);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:var(--mut2);">${icon(ic,30)}</div>
    <div style="font-weight:800;font-size:15px;">${title}</div>
    <div class="tiny muted" style="margin-top:5px;line-height:1.5;max-width:270px;margin-left:auto;margin-right:auto;">${sub}</div></div>`;
}
// Hydrate static-HTML icon placeholders: <span data-icon="bolt" data-sz="16"></span>
function hydrateIcons(root){
  (root||document).querySelectorAll('[data-icon]').forEach(el=>{
    const n=el.dataset.icon, sz=+el.dataset.sz||18;
    el.innerHTML = n==='flame' ? flameSVG(sz) : icon(n, sz);
  });
}
function icon(name, sz, style){
  const ic=ICONS[name]; if(!ic) return '';
  sz=sz||18;
  const body=ic.d.startsWith('<')?ic.d:`<path d="${ic.d}"/>`;
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block;vertical-align:-0.2em;flex-shrink:0;${style||''}" ${ic.f
    ?'fill="currentColor"'
    :'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;
}
// Brand flame — gradient-filled, used for streaks everywhere.
let _flameN=0;
const FLAME_PALETTES={ default:['#ffd36b','#ff7a2f','#e03d10','#ffe9a8'], cold:['#9fc9ff','#3f7ddd','#274a9e','#cfe4ff'], phoenix:['#d9b8ff','#8a5cff','#5b2bd6','#efe2ff'] };
function flameSVG(sz, variant){
  const id='fl'+(++_flameN), p=FLAME_PALETTES[variant]||FLAME_PALETTES.default;
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block;vertical-align:-0.2em;flex-shrink:0;">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset=".55" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient></defs>
    <path d="M12 2.2c.6 2.9-.5 4.7-2 6.4C8.4 10.4 7 12 7 14.4a5 5 0 0 0 10 0c0-1.9-.8-3.4-2-4.8-.2 1.1-.8 2-1.7 2.5.6-3.1-.2-7-1.3-9.9z" fill="url(#${id})"/>
    <path d="M12 21.5a3.1 3.1 0 0 1-3.1-3.1c0-1.5.9-2.4 1.9-3.4.5-.5 1-1.1 1.2-1.8.8.9 2 2.6 2 4.2a3.4 3.4 0 0 1-2 4.1z" fill="${p[3]}" opacity=".85"/>
  </svg>`;
}
// Consumable art — SVG with the store's badge composite (replaces emoji art).
function consumableArt(id, sz){
  sz=sz||48;
  const badge=(art,txt,c)=>`<div style="position:relative;width:${sz+6}px;height:${sz+4}px;display:flex;align-items:center;justify-content:center;">${art}${txt?`<div style="position:absolute;right:-7px;bottom:0;background:${c};color:#fff;font-size:${Math.max(10,Math.round(sz*0.24))}px;font-weight:900;border-radius:50%;width:${Math.round(sz*0.5)}px;height:${Math.round(sz*0.5)}px;display:flex;align-items:center;justify-content:center;border:2px solid #0c0c12;">${txt}</div>`:''}</div>`;
  if(id==='xp2') return badge(`<span style="color:#4ea3ff;">${icon('shaker',sz)}</span>`,'2×','#4ea3ff');
  if(id==='xp3') return badge(`<span style="color:#ff7a3c;">${icon('shaker',sz)}</span>`,'3×','#ff7a3c');
  if(id==='freeze') return badge(`<span style="color:#9fd8ff;">${icon('snowflake',sz)}</span>`,'','');
  if(id==='phoenix') return `<div style="filter:drop-shadow(0 0 10px #8a5cff);">${badge(flameSVG(sz,'phoenix'),'∞','#8a6cff')}</div>`;
  if(id==='rest30') return badge(flameSVG(sz),'30','#4ea3ff');
  if(id==='rest60') return badge(flameSVG(sz),'60','#ff5a3c');
  return flameSVG(sz);
}
// Leaderboard medals — gold/silver/bronze discs with ribbon, or a plain number.
function medalSVG(place, sz){
  if(place>2) return `<span style="font-weight:800;color:var(--mut);">${place+1}</span>`;
  const c=[['#ffd76a','#b8860b','#8a5a00'],['#e3e8f2','#9aa6bd','#5d6b85'],['#f0b27a','#b06a2c','#7a4516']][place];
  return `<svg width="${sz||26}" height="${sz||26}" viewBox="0 0 24 24" aria-hidden="true" style="display:block;">
    <path d="M9.2 9.8L6 2.6h4.4L12 6.4l1.6-3.8H18l-3.2 7.2z" fill="${c[1]}"/>
    <circle cx="12" cy="14.6" r="6" fill="${c[0]}" stroke="${c[2]}" stroke-width="1.1"/>
    <text x="12" y="17.6" text-anchor="middle" font-size="8.4" font-weight="900" fill="${c[2]}">${place+1}</text>
  </svg>`;
}

