// All Supabase traffic lives here (spec: migration posture — swap this file to change backends).
// window.cloud is the only API the app uses.
window.cloud = (() => {
  const sb = window.supabase && window.ASCEND_SUPABASE_URL
    ? window.supabase.createClient(window.ASCEND_SUPABASE_URL, window.ASCEND_SUPABASE_KEY) : null;
  const C = window.SyncCore;
  let user = null, syncing = false, onChange = () => {};

  // ---- offline queue (localStorage 'ascend_q'): {profile:true, sessions:[start..], meals:[ts..], routines:true, customEx:true}
  const q = () => { try { return JSON.parse(localStorage.getItem('ascend_q')) || {}; } catch(e){ return {}; } };
  const qSave = x => localStorage.setItem('ascend_q', JSON.stringify(x));
  let syncT = null;
  const kick = () => { if(navigator.onLine){ clearTimeout(syncT); syncT = setTimeout(() => syncNow(), 800); } };
  const mark = (kind, key) => { const x = q();
    if (kind==='sessions'||kind==='meals'){ x[kind]=x[kind]||[]; if(!x[kind].includes(key)) x[kind].push(key); }
    else x[kind]=true; qSave(x); kick(); };

  const ready = () => !!(sb && user);
  const init = async () => {
    if (!sb) return null;
    const { data:{ session } } = await sb.auth.getSession();
    user = session ? session.user : null;
    sb.auth.onAuthStateChange((_e, s) => { user = s ? s.user : null; onChange(); });
    window.addEventListener('online', () => syncNow());
    return user;
  };

  // ---- auth
  const signUp = async (email, password, username) => {
    const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ username } } });
    if (error) throw error; user = data.user; return user;
  };
  const signIn = async (email, password) => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error; user = data.user; return user;
  };
  const signOut = async () => { await sb.auth.signOut(); user = null; };

  // ---- push (drain queue)
  const syncNow = async () => {
    if (!ready() || syncing || !navigator.onLine) return;
    syncing = true;
    try {
      const S = window.S, x = q(), uid = user.id;
      if (x.profile) {
        const { error } = await sb.from('profiles').update(C.profileToRow(S, S.profileUpdatedAt||Date.now())).eq('id', uid);
        if (!error) { const y = q(); delete y.profile; qSave(y); }
      }
      if (x.sessions && x.sessions.length) {
        const rows = S.sessions.filter(s => x.sessions.includes(s.start))
          .map(s => ({ user_id: uid, started_at: s.start, ended_at: s.end||null, exercises: s.exercises }));
        const { error } = rows.length ? await sb.from('sessions').upsert(rows, { onConflict:'user_id,started_at' }) : { error:null };
        if (!error) { const y = q(); delete y.sessions; qSave(y); }
      }
      if (x.meals && x.meals.length) {
        const rows = S.meals.filter(m => x.meals.includes(m.ts))
          .map(m => ({ user_id: uid, ts: m.ts, day: m.day, entry: m }));
        const { error } = rows.length ? await sb.from('meals').upsert(rows, { onConflict:'user_id,ts' }) : { error:null };
        if (!error) { const y = q(); delete y.meals; qSave(y); }
      }
      if (x.routines) {
        S.routines = C.ensureRids(S.routines, () => Date.now() + Math.floor(Math.random()*1000));
        const rows = (S.routines||[]).map(rt => ({ user_id: uid, rid: rt.rid, name: rt.name, items: rt.items }));
        const del = await sb.from('routines').delete().eq('user_id', uid);
        const ins = rows.length ? await sb.from('routines').insert(rows) : { error: null };
        if (!del.error && !ins.error) { const y = q(); delete y.routines; qSave(y); }
      }
      if (x.customEx) {
        const rows = (S.customEx||[]).map(c => ({ user_id: uid, ex_id: c.id, name: c.name, grp: c.group, equipment: c.equipment||null }));
        const { error } = rows.length ? await sb.from('custom_exercises').upsert(rows, { onConflict:'user_id,ex_id' }) : { error:null };
        if (!error) { const y = q(); delete y.customEx; qSave(y); }
      }
    } finally { syncing = false; }
  };

  // ---- pull (login / startup): cloud → S, merged
  const pullAll = async () => {
    if (!ready()) return null;
    const uid = user.id, S = window.S;
    const [p, se, rt, me, cx] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).single(),
      sb.from('sessions').select('*').eq('user_id', uid),
      sb.from('routines').select('*').eq('user_id', uid),
      sb.from('meals').select('*').eq('user_id', uid),
      sb.from('custom_exercises').select('*').eq('user_id', uid),
    ]);
    if (p.data) Object.assign(S, C.mergeProfile(S, C.profileFromRow(p.data)));
    if (se.data) S.sessions = C.mergeAppendOnly(S.sessions,
      se.data.map(r => ({ start:+r.started_at, end:r.ended_at?+r.ended_at:null, exercises:r.exercises })), s => s.start);
    if (me.data) S.meals = C.mergeAppendOnly(S.meals, me.data.map(r => r.entry), m => m.ts);
    if (rt.data && rt.data.length) S.routines = rt.data.map(r => ({ rid:+r.rid, name:r.name, items:r.items }));
    if (cx.data) { S.customEx = S.customEx||[]; cx.data.forEach(r => {
      if (!S.customEx.find(c => c.id===r.ex_id)) S.customEx.push({ id:r.ex_id, name:r.name, group:r.grp, equipment:r.equipment });
    }); }
    return S;
  };

  // first-login from a device that already has local data: queue everything up.
  const queueAllLocal = () => { const S = window.S;
    qSave({ profile:true, routines:true, customEx:true,
      sessions:(S.sessions||[]).map(s => s.start), meals:(S.meals||[]).map(m => m.ts) });
    if (navigator.onLine) syncNow();
  };

  const pending = () => { const x = q();
    return (x.profile?1:0)+(x.routines?1:0)+(x.customEx?1:0)+((x.sessions||[]).length)+((x.meals||[]).length); };

  return { init, ready, signUp, signIn, signOut, syncNow, pullAll, queueAllLocal, mark, pending,
    user: () => user, configured: !!sb, onAuthChange: f => { onChange = f; } };
})();
