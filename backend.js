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
    if (error) throw error;
    // No session back = the project still requires email confirmation; without SMTP
    // configured that mail never arrives, so surface it loudly instead of half-working.
    if (!data.session) throw new Error('confirm-email-on');
    user = data.user; return user;
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
    startRealtime();
    return S;
  };

  // ---- social (Phase 3): friends, nudges, leaderboard
  const me = () => user && user.id;
  const pair = (a, b) => a < b ? { user_a:a, user_b:b } : { user_a:b, user_b:a };
  const searchUsers = async q => {
    const { data } = await sb.from('profiles').select('id,username,sr').ilike('username', '%'+q+'%').neq('id', me()).limit(8);
    return data || [];
  };
  const sendFriendRequest = async otherId => {
    const { error } = await sb.from('friendships').insert({ ...pair(me(), otherId), requested_by: me() });
    if (error) throw error;
  };
  const respondFriend = async (id, accept) => {
    const { error } = accept
      ? (await sb.from('friendships').update({ status:'accepted' }).eq('id', id))
      : (await sb.from('friendships').delete().eq('id', id));
    if (error) throw error;
  };
  const listFriendships = async () => {
    const { data } = await sb.from('friendships')
      .select('*, a:profiles!friendships_user_a_fkey(id,username,sr,streak), b:profiles!friendships_user_b_fkey(id,username,sr,streak)');
    return (data || []).map(f => ({ ...f, other: f.user_a === me() ? f.b : f.a, mine: f.requested_by === me() }));
  };
  const sendNudge = async (toId, msg) => {
    const { data, error } = await sb.from('nudges').insert({ from_user: me(), to_user: toId, msg }).select('id').single();
    if (error) throw error;
    // fire-and-forget: ask the edge function to push an OS notification to their devices
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) fetch(window.ASCEND_SUPABASE_URL + '/functions/v1/push-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token, 'apikey': window.ASCEND_SUPABASE_KEY },
        body: JSON.stringify({ nudge_id: data.id }),
      }).catch(() => {});
    } catch (e) {}
  };

  // ---- Web Push opt-in (per device)
  const b64ToU8 = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...b].map(c => c.charCodeAt(0))); };
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const pushEnabled = async () => {
    if (!pushSupported()) return false;
    try { const reg = await navigator.serviceWorker.ready; return !!(await reg.pushManager.getSubscription()); } catch (e) { return false; }
  };
  const enablePush = async () => {
    if (!pushSupported()) throw new Error('push-unsupported');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('push-denied');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(window.ASCEND_VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert(
      { user_id: me(), endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
    if (error) throw error;
    return true;
  };
  const disablePush = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { try { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch (e) {} await sub.unsubscribe(); }
  };
  const listNudges = async () => {
    const { data } = await sb.from('nudges').select('*, sender:profiles!nudges_from_user_fkey(username,sr)')
      .eq('to_user', me()).eq('seen', false).order('created_at', { ascending:false });
    return data || [];
  };
  const markNudgeSeen = async id => { await sb.from('nudges').update({ seen:true }).eq('id', id); };
  const getLeaderboard = async () => {
    const { data } = await sb.from('profiles').select('id,username,sr').order('sr', { ascending:false }).limit(100);
    return data || [];
  };
  // ---- feed (Phase 4): posts + likes
  const createPost = async (type, payload, mediaDataUrl) => {
    const uid = me(); let media_path = null;
    if (mediaDataUrl) {
      try {
        const blob = await (await fetch(mediaDataUrl)).blob();
        const path = `${uid}/${Date.now()}.jpg`;
        const { error } = await sb.storage.from('post-media').upload(path, blob, { contentType:'image/jpeg', upsert:false });
        if (!error) media_path = path;
      } catch (e) {}
    }
    const { data, error } = await sb.from('posts').insert({ user_id: uid, type, payload: payload || {}, media_path }).select('id').single();
    if (error) throw error;
    return data.id;
  };
  const getFeed = async () => {
    const { data } = await sb.from('posts')
      .select('id,user_id,type,payload,media_path,created_at, author:profiles!posts_user_id_fkey(id,username,sr), likes(user_id)')
      .order('created_at', { ascending:false }).limit(60);
    const posts = data || [];
    const paths = posts.filter(p => p.media_path).map(p => p.media_path);
    const signed = {};
    if (paths.length) {
      try { const { data: urls } = await sb.storage.from('post-media').createSignedUrls(paths, 3600);
        (urls || []).forEach(u => { if (u.path && u.signedUrl) signed[u.path] = u.signedUrl; }); } catch (e) {}
    }
    const uid = me();
    return posts.map(p => ({
      id: p.id, type: p.type, payload: p.payload || {}, created_at: p.created_at,
      author: p.author, mine: p.user_id === uid, media_url: p.media_path ? signed[p.media_path] : null,
      likeCount: (p.likes || []).length, liked: (p.likes || []).some(l => l.user_id === uid),
    }));
  };
  const toggleLike = async (postId, on) => {
    if (on) { const { error } = await sb.from('likes').insert({ post_id: postId, user_id: me() });
      if (error && !String(error.message).includes('duplicate')) throw error; }
    else await sb.from('likes').delete().eq('post_id', postId).eq('user_id', me());
  };
  const deletePost = async postId => { const { error } = await sb.from('posts').delete().eq('id', postId); if (error) throw error; };

  // ---- duels (Phase 5)
  const uploadProof = async (dataUrl) => {
    if (!dataUrl) return null;
    try { const blob = await (await fetch(dataUrl)).blob(); const path = `${me()}/duel_${Date.now()}.jpg`;
      const { error } = await sb.storage.from('post-media').upload(path, blob, { contentType:'image/jpeg' });
      return error ? null : path; } catch (e) { return null; }
  };
  const challengeDuel = async (opponentId, exId) => {
    const { error } = await sb.from('duels').insert({ challenger: me(), opponent: opponentId, ex_id: exId, status: 'pending' });
    if (error) throw error;
  };
  const listDuels = async () => {
    const { data } = await sb.from('duels')
      .select('*, c:profiles!duels_challenger_fkey(id,username,sr,comp), o:profiles!duels_opponent_fkey(id,username,sr,comp)')
      .order('created_at', { ascending:false }).limit(40);
    const uid = me();
    return (data || []).map(d => ({ ...d, iAmChallenger: d.challenger === uid,
      meSide: d.challenger === uid ? 'c' : 'o', them: d.challenger === uid ? d.o : d.c }));
  };
  const respondDuel = async (id, accept) => {
    const { error } = accept ? await sb.from('duels').update({ status:'active' }).eq('id', id)
                             : await sb.from('duels').update({ status:'declined' }).eq('id', id);
    if (error) throw error;
  };
  const submitDuel = async (id, side, weight, photoDataUrl) => {
    const path = await uploadProof(photoDataUrl);
    const patch = side === 'c'
      ? { c_weight: weight, c_photo: path, c_at: new Date().toISOString() }
      : { o_weight: weight, o_photo: path, o_at: new Date().toISOString() };
    const { error } = await sb.from('duels').update(patch).eq('id', id);
    if (error) throw error;
    // if both sides are now in, ask the server to resolve (sets winner + SR on both)
    const { data: d } = await sb.from('duels').select('c_weight,o_weight,status,winner').eq('id', id).single();
    if (d && d.status === 'active' && !d.winner && d.c_weight != null && d.o_weight != null) {
      const { data: { session } } = await sb.auth.getSession();
      try { await fetch(window.ASCEND_SUPABASE_URL + '/functions/v1/resolve-duel', {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+session.access_token, 'apikey':window.ASCEND_SUPABASE_KEY },
        body: JSON.stringify({ duel_id: id }) }); } catch (e) {}
    }
  };
  const signedProof = async (path) => { if (!path) return null;
    try { const { data } = await sb.storage.from('post-media').createSignedUrl(path, 3600); return data && data.signedUrl; } catch (e) { return null; } };

  // ---- chat (Phase 5)
  const getMessages = async (friendId) => {
    const { data } = await sb.from('messages').select('*')
      .or(`and(from_user.eq.${me()},to_user.eq.${friendId}),and(from_user.eq.${friendId},to_user.eq.${me()})`)
      .order('created_at', { ascending:true }).limit(200);
    const uid = me();
    return (data || []).map(m => ({ id:m.id, me: m.from_user === uid, text:m.text, routine:m.routine, ts:new Date(m.created_at).getTime() }));
  };
  const sendMessage = async (toId, text, routine) => {
    const { data, error } = await sb.from('messages').insert({ from_user: me(), to_user: toId, text: text||null, routine: routine||null }).select('id,created_at').single();
    if (error) throw error;
    return data;
  };

  // ---- AI meal recognition (server-capped; see scan-meal function)
  const aiRemaining = async () => {
    if (!ready()) return null;
    try { const { data } = await sb.rpc('ai_remaining', { p_kind: 'scan_meal', p_user_max: 25 }); return data; }
    catch (e) { return null; }
  };
  const aiScanMeal = async (imageDataUrl) => {
    if (!ready()) return { ok: false, reason: 'signed-out' };
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch(window.ASCEND_SUPABASE_URL + '/functions/v1/scan-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token, 'apikey': window.ASCEND_SUPABASE_KEY },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      return await r.json().catch(() => ({ ok: false, reason: 'error' }));
    } catch (e) { return { ok: false, reason: 'offline' }; }
  };

  // live nudges / friend requests / feed / duels / messages while the app is open
  let rtChannel = null, socialCb = () => {};
  const startRealtime = () => {
    if (!ready() || rtChannel) return;
    rtChannel = sb.channel('social')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'nudges', filter:'to_user=eq.'+me() }, p => socialCb({ type:'nudge', row:p.new }))
      .on('postgres_changes', { event:'*', schema:'public', table:'friendships' }, p => socialCb({ type:'friend', row:p.new || p.old }))
      .on('postgres_changes', { event:'*', schema:'public', table:'posts' }, p => socialCb({ type:'post', row:p.new || p.old }))
      .on('postgres_changes', { event:'*', schema:'public', table:'likes' }, p => socialCb({ type:'like', row:p.new || p.old }))
      .on('postgres_changes', { event:'*', schema:'public', table:'duels' }, p => socialCb({ type:'duel', row:p.new || p.old }))
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:'to_user=eq.'+me() }, p => socialCb({ type:'message', row:p.new }))
      .subscribe();
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
    searchUsers, sendFriendRequest, respondFriend, listFriendships, sendNudge, listNudges, markNudgeSeen,
    getLeaderboard, startRealtime, onSocial: f => { socialCb = f; },
    createPost, getFeed, toggleLike, deletePost,
    challengeDuel, listDuels, respondDuel, submitDuel, signedProof,
    getMessages, sendMessage, aiScanMeal, aiRemaining,
    pushSupported, pushEnabled, enablePush, disablePush,
    user: () => user, configured: !!sb, onAuthChange: f => { onChange = f; } };
})();
