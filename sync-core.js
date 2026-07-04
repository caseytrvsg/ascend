// Pure sync logic — no DOM, no Supabase. Loaded in-browser as window.SyncCore,
// loaded in node tests via eval with a stub window.
window.SyncCore = (() => {
  // Fields the client may write to its profiles row (settings/derived; last-write-wins).
  // NOTE: `pro`/`pro_until` and `comp` are intentionally NOT sent — they're server-authoritative
  // (set by the grant-pro / resolve-duel edge functions) and the profiles_guard DB trigger
  // rejects client writes to them anyway. We only ever READ them back (profileFromRow).
  const profileToRow = (S, now) => ({
    bw:S.bw??null, units:S.units||'lb', height_cm:S.heightCm??null, height_unit:S.heightUnit||'cm',
    age:S.age??null, sex:S.sex??null, activity:S.activity||'moderate', goal:S.goal??null,
    calories:S.calories??null, body_fat:S.bodyFat??null, shards:S.shards||0,
    owned:S.owned||[], inv:S.inv||{}, theme:S.theme||'th_mid', border:S.border||'bd_none',
    banner:S.banner||'bn_none', boost:S.boost||null, streak:S.stk||null,
    sr:Math.round(S.sr||0),   // sr column is an integer — overallSR() is a float, so round or the PATCH 400s

    updated_at: now
  });
  // Effective Pro = the server flag, honoring an expiry if one is set (client clock is fine here —
  // it's only the cosmetic gate; anything that costs money is re-checked server-side).
  const proActive = r => !!r.pro && (!r.pro_until || new Date(r.pro_until).getTime() > Date.now());
  const profileFromRow = r => ({
    name:r.username, bw:r.bw!=null?+r.bw:null, units:r.units, heightCm:r.height_cm!=null?+r.height_cm:null,
    heightUnit:r.height_unit, age:r.age, sex:r.sex, activity:r.activity, goal:r.goal,
    calories:r.calories, bodyFat:r.body_fat!=null?+r.body_fat:null, pro:proActive(r), proUntil:r.pro_until||null, shards:r.shards,
    owned:r.owned||[], inv:r.inv||{}, theme:r.theme, border:r.border, banner:r.banner,
    boost:r.boost, stk:r.streak||undefined, comp:r.comp||undefined, profileUpdatedAt:+r.updated_at||0
  });
  // Last-write-wins on the whole settings block.
  const mergeProfile = (local, cloud) =>
    (+cloud.profileUpdatedAt||0) > (+local.profileUpdatedAt||0) ? { ...local, ...cloud } : local;
  // Append-only collections: union by client key, cloud fills gaps, sorted by key.
  const mergeAppendOnly = (local, cloud, keyOf) => {
    const seen = new Map(); [...(local||[]), ...(cloud||[])].forEach(r => { if(!seen.has(keyOf(r))) seen.set(keyOf(r), r); });
    return [...seen.values()].sort((a,b) => keyOf(a) - keyOf(b));
  };
  const ensureRids = (routines, nextId) => (routines||[]).map(rt => rt.rid ? rt : { ...rt, rid: nextId() });
  return { profileToRow, profileFromRow, mergeProfile, mergeAppendOnly, ensureRids };
})();
