# ASCEND Backend Phase 1 — Accounts + Cloud Save + Live Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ASCEND live at `https://caseytrvsg.github.io/ascend/` with real email+password accounts and offline-first cloud sync of all training data.

**Architecture:** The single-file PWA stays the UI source of truth via localStorage; a new `backend.js` data layer owns every Supabase call and an offline write-queue that flushes when online. Pure merge/mapping logic lives in `sync-core.js` so it is testable with `node --test`. Schema + row-level security ship as a versioned SQL migration applied in the Supabase SQL Editor.

**Tech Stack:** Vanilla JS PWA (no build step) · `@supabase/supabase-js` v2 vendored UMD · Supabase (Postgres, Auth, RLS) · GitHub Pages · `node --test` for pure logic.

**Spec:** `docs/superpowers/specs/2026-06-12-ascend-backend-design.md`

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/0001_phase1.sql` | Create | Tables, RLS policies, new-user trigger (versioned copy of what runs in SQL Editor) |
| `vendor/supabase-js.js` | Create | Vendored supabase-js v2 UMD bundle (offline-capable, SW-cached) |
| `config.js` | Create | `ASCEND_SUPABASE_URL` + `ASCEND_SUPABASE_KEY` (publishable anon key — safe to ship; RLS is the lock) |
| `sync-core.js` | Create | Pure functions: row↔app mapping, merge rules, queue helpers. No Supabase, no DOM |
| `backend.js` | Create | Supabase client, auth API, offline queue, `syncNow()` push, `pullAll()` reconcile |
| `tests/sync-core.test.mjs` | Create | `node --test` coverage for sync-core |
| `index.html` | Modify | Script tags; account step in onboarding; account section in Settings; `save()` sync hook; startup pull |
| `sw.js` | Modify | Add new files to CORE, bump VERSION to `ascend-v5` |

Conventions: epoch-ms timestamps (matches app `Date.now()` usage). Client-generated keys make sync idempotent: sessions keyed `(user_id, started_at)`, meals `(user_id, ts)`, routines get a new client id `rid` (epoch-ms at creation), custom exercises `(user_id, ex_id)`.

---

### Task 0: Casey creates the Supabase project (manual, ~5 min)

**Files:** none — operator action. Agent walks Casey through it conversationally.

- [ ] **Step 1: Create account + project.** At `https://supabase.com` → Start your project → sign in with GitHub (`caseytrvsg`). New project: name `ascend`, generate a strong DB password (Supabase stores it; we never need it directly), region = closest to Casey (eu-west for UK). Wait ~2 min for provisioning.
- [ ] **Step 2: Turn off email confirmation** (friends-circle: no SMTP setup). Dashboard → Authentication → Sign In / Up → Email → toggle **Confirm email** OFF → Save.
- [ ] **Step 3: Collect the two values.** Dashboard → Project Settings → API: copy **Project URL** (`https://<ref>.supabase.co`) and the **anon / publishable key**. Casey pastes both into chat. Agent records them for Task 2 Step 2.
- [ ] **Step 4: Verify** — agent opens nothing; just confirm both values look like a URL and a long `eyJ…`/`sb_publishable_…` string.

### Task 1: Database schema + row-level security

**Files:**
- Create: `supabase/migrations/0001_phase1.sql`

- [ ] **Step 1: Write the migration file** with exactly this content:

```sql
-- ASCEND Phase 1: profiles + training data. RLS everywhere.
-- profiles: 1 row per account. Settings/derived fields = last-write-wins via updated_at.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  bw numeric, units text default 'lb', height_cm numeric, height_unit text default 'cm',
  age int, sex text, activity text default 'moderate', goal text, calories int, body_fat numeric,
  pro boolean default false, shards int default 120,
  owned jsonb default '["th_mid","bd_none","bn_none"]', inv jsonb default '{}',
  theme text default 'th_mid', border text default 'bd_none', banner text default 'bn_none',
  boost jsonb, streak jsonb, comp jsonb default '{"tier":0,"div":0,"sr":0,"wins":0,"losses":0,"streak":0}',
  sr int default 0,
  updated_at bigint default 0          -- epoch ms, client-stamped, last-write-wins
);

create table public.sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at bigint not null, ended_at bigint, exercises jsonb not null default '[]',
  unique (user_id, started_at)
);

create table public.routines (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rid bigint not null, name text, items jsonb not null default '[]',
  unique (user_id, rid)
);

create table public.meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ts bigint not null, day text not null, entry jsonb not null,
  unique (user_id, ts)
);

create table public.custom_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ex_id text not null, name text not null, grp text not null, equipment text,
  unique (user_id, ex_id)
);

-- Auto-create profile on signup (username arrives via auth metadata).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'lifter_' || substr(new.id::text,1,8)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.routines enable row level security;
alter table public.meals enable row level security;
alter table public.custom_exercises enable row level security;

-- profiles: any signed-in user may read (leaderboards later); only you write yours.
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- training data: owner-only, all operations.
create policy "own sessions" on public.sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own routines" on public.routines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own meals" on public.meals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own custom_exercises" on public.custom_exercises for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Apply it.** Supabase Dashboard → SQL Editor → New query → paste the whole file → Run. Expected: "Success. No rows returned".
- [ ] **Step 3: Verify.** Table Editor shows 5 tables; `profiles` has RLS badge ON. Authentication → Policies lists 6 policies.
- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "Phase 1: database schema + row-level security migration"
```

### Task 2: Vendor supabase-js + config

**Files:**
- Create: `vendor/supabase-js.js`
- Create: `config.js`
- Modify: `index.html` (script tags, just before the existing inline `<script>`)
- Modify: `sw.js` (CORE list + VERSION)

- [ ] **Step 1: Download the UMD bundle** (~110 KB min) into the repo:

```powershell
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" -OutFile vendor/supabase-js.js
```

- [ ] **Step 2: Create `config.js`** (values from Task 0 Step 3):

```js
// Supabase project coordinates. The key is the *publishable* anon key — safe to ship;
// row-level security (see supabase/migrations/) is what protects data, not this key.
window.ASCEND_SUPABASE_URL = "https://<PROJECT_REF>.supabase.co";
window.ASCEND_SUPABASE_KEY = "<ANON_KEY>";
```

- [ ] **Step 3: Wire scripts into `index.html`.** The app's inline script starts after the modals; insert before it (next to the existing `<script src="anatomy.js">` includes — search for `anatomy.js`):

```html
<script src="vendor/supabase-js.js"></script>
<script src="config.js"></script>
<script src="sync-core.js"></script>
<script src="backend.js" defer></script>
```

`sync-core.js` and `backend.js` are created in Tasks 3–4; create them as empty files in this step so nothing 404s: `sync-core.js` containing `window.SyncCore={};` and `backend.js` containing `window.cloud={ready:false};`.

- [ ] **Step 4: Update `sw.js`** — VERSION `'ascend-v5'`; CORE gains `'vendor/supabase-js.js', 'config.js', 'sync-core.js', 'backend.js'`.
- [ ] **Step 5: Verify in preview.** Reload; `preview_eval`: `typeof window.supabase.createClient` → `"function"`; console has no 404s.
- [ ] **Step 6: Commit**

```bash
git add vendor/ config.js sync-core.js backend.js index.html sw.js
git commit -m "Phase 1: vendor supabase-js, config, script wiring, sw v5"
```

### Task 3: sync-core.js pure logic (TDD)

**Files:**
- Create: `sync-core.js`
- Test: `tests/sync-core.test.mjs`

- [ ] **Step 1: Write the failing tests** (`tests/sync-core.test.mjs`). sync-core is a browser global, so the test loads it by evaluating the file with a stub `window`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const window = {};
eval(readFileSync(new URL('../sync-core.js', import.meta.url), 'utf8'));
const C = window.SyncCore;

test('profileToRow / profileFromRow roundtrip the fields that matter', () => {
  const S = { name:'Casey', bw:185, units:'lb', heightCm:180, heightUnit:'ft', age:27, sex:'m',
    activity:'active', goal:'Build muscle', calories:null, bodyFat:14, pro:false, shards:120,
    owned:['th_mid'], inv:{}, theme:'th_mid', border:'bd_none', banner:'bn_none', boost:null,
    stk:{count:2}, comp:{tier:0,div:0,sr:0,wins:0,losses:0,streak:0}, profileUpdatedAt: 111 };
  const row = C.profileToRow(S, 500);
  assert.equal(row.username, undefined);            // username never updated via sync
  assert.equal(row.bw, 185); assert.equal(row.updated_at, 500);
  const back = C.profileFromRow({ ...row, username:'Casey' });
  assert.equal(back.bw, 185); assert.equal(back.name, 'Casey'); assert.equal(back.profileUpdatedAt, 500);
});

test('mergeProfile: newer side wins', () => {
  const local = { bw:185, profileUpdatedAt: 200 };
  const cloudNewer = { bw:190, profileUpdatedAt: 300 };
  const cloudOlder = { bw:170, profileUpdatedAt: 100 };
  assert.equal(C.mergeProfile(local, cloudNewer).bw, 190);
  assert.equal(C.mergeProfile(local, cloudOlder).bw, 185);
});

test('mergeAppendOnly unions by key and sorts', () => {
  const local = [{ start: 100, x:'a' }, { start: 300, x:'c' }];
  const cloud = [{ start: 100, x:'a' }, { start: 200, x:'b' }];
  const out = C.mergeAppendOnly(local, cloud, r => r.start);
  assert.deepEqual(out.map(r => r.start), [100, 200, 300]);
});

test('ensureRids assigns missing routine ids without touching existing', () => {
  const routines = [{ name:'Push', items:[] }, { rid: 42, name:'Pull', items:[] }];
  const out = C.ensureRids(routines, () => 999);
  assert.equal(out[0].rid, 999); assert.equal(out[1].rid, 42);
});
```

- [ ] **Step 2: Run to verify failure.** `node --test tests/` → expected: 4 failing (SyncCore empty).
- [ ] **Step 3: Implement `sync-core.js`:**

```js
// Pure sync logic — no DOM, no Supabase. Loaded in-browser as window.SyncCore,
// loaded in node tests via eval with a stub window.
window.SyncCore = (() => {
  // Fields that sync to the profiles row (settings/derived; last-write-wins).
  const profileToRow = (S, now) => ({
    bw:S.bw??null, units:S.units||'lb', height_cm:S.heightCm??null, height_unit:S.heightUnit||'cm',
    age:S.age??null, sex:S.sex??null, activity:S.activity||'moderate', goal:S.goal??null,
    calories:S.calories??null, body_fat:S.bodyFat??null, pro:!!S.pro, shards:S.shards||0,
    owned:S.owned||[], inv:S.inv||{}, theme:S.theme||'th_mid', border:S.border||'bd_none',
    banner:S.banner||'bn_none', boost:S.boost||null, streak:S.stk||null, comp:S.comp||null,
    updated_at: now
  });
  const profileFromRow = r => ({
    name:r.username, bw:r.bw!=null?+r.bw:null, units:r.units, heightCm:r.height_cm!=null?+r.height_cm:null,
    heightUnit:r.height_unit, age:r.age, sex:r.sex, activity:r.activity, goal:r.goal,
    calories:r.calories, bodyFat:r.body_fat!=null?+r.body_fat:null, pro:r.pro, shards:r.shards,
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
```

- [ ] **Step 4: Run tests to verify pass.** `node --test tests/` → 4 pass.
- [ ] **Step 5: Commit**

```bash
git add sync-core.js tests/
git commit -m "Phase 1: sync-core pure merge/mapping logic with node tests"
```

### Task 4: backend.js data layer (auth + offline queue + sync)

**Files:**
- Create: `backend.js` (replaces the Task 2 stub)

- [ ] **Step 1: Implement `backend.js`:**

```js
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
  const mark = (kind, key) => { const x = q();
    if (kind==='sessions'||kind==='meals'){ x[kind]=x[kind]||[]; if(!x[kind].includes(key)) x[kind].push(key); }
    else x[kind]=true; qSave(x); if(navigator.onLine) syncNow(); };

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
        const { error } = await sb.from('sessions').upsert(rows, { onConflict:'user_id,started_at' });
        if (!error) { const y = q(); delete y.sessions; qSave(y); }
      }
      if (x.meals && x.meals.length) {
        const rows = S.meals.filter(m => x.meals.includes(m.ts))
          .map(m => ({ user_id: uid, ts: m.ts, day: m.day, entry: m }));
        const { error } = await sb.from('meals').upsert(rows, { onConflict:'user_id,ts' });
        if (!error) { const y = q(); delete y.meals; qSave(y); }
      }
      if (x.routines) {
        S.routines = C.ensureRids(S.routines, () => Date.now() + Math.floor(Math.random()*1000));
        const rows = S.routines.map(rt => ({ user_id: uid, rid: rt.rid, name: rt.name, items: rt.items }));
        const del = await sb.from('routines').delete().eq('user_id', uid);
        const ins = rows.length ? await sb.from('routines').insert(rows) : { error: null };
        if (!del.error && !ins.error) { const y = q(); delete y.routines; qSave(y); }
      }
      if (x.customEx) {
        const rows = (S.customEx||[]).map(c => ({ user_id: uid, ex_id: c.id, name: c.name, grp: c.group, equipment: c.equipment||null }));
        if (rows.length) await sb.from('custom_exercises').upsert(rows, { onConflict:'user_id,ex_id' });
        const y = q(); delete y.customEx; qSave(y);
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
    if (cx.data) (S.customEx = (S.customEx||[])) && cx.data.forEach(r => {
      if (!S.customEx.find(c => c.id===r.ex_id)) S.customEx.push({ id:r.ex_id, name:r.name, group:r.grp, equipment:r.equipment });
    });
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
```

- [ ] **Step 2: Hook the app's `save()`** in `index.html`. Current line: `function save(){ localStorage.setItem('ascend', JSON.stringify(S)); }` → replace with:

```js
function save(){ localStorage.setItem('ascend', JSON.stringify(S));
  if(window.cloud && cloud.ready()){ S.profileUpdatedAt=Date.now(); cloud.mark('profile'); } }
```

Then add precise marks where collections change (profile mark alone re-syncs settings; collections need their keys):
- in `finishSession()` (search `S.sessions.push`): after the push → `if(cloud.ready()) cloud.mark('sessions', ses.start);`
- in `logScan()`, `logBarcode()`, `logFood()` (each does `S.meals.push`): after → `if(cloud.ready()) cloud.mark('meals', <the pushed entry>.ts);`
- in routine create/edit/delete (search `S.routines`): after each mutation → `if(cloud.ready()) cloud.mark('routines');`
- in `submitCustomEx()`: after registering → `if(cloud.ready()) cloud.mark('customEx');`

- [ ] **Step 3: Startup wiring** in `index.html`. Near the bottom (next to the existing `if(!S.onboarded …) startOnboarding();` line), add:

```js
window.S = S;
if (window.cloud && cloud.configured) cloud.init().then(u => { if (u) cloud.pullAll().then(() => { save(); go(currentScreen||'train'); }); });
```

(`go(...)` re-render after pull; reuse however the app names its current-screen variable — verify at implementation time and adjust.)

- [ ] **Step 4: Verify in preview.** Reload; `preview_eval`: `cloud.configured` → `true`; `cloud.pending()` → `0`; console clean.
- [ ] **Step 5: Commit**

```bash
git add backend.js index.html
git commit -m "Phase 1: cloud data layer — auth, offline queue, push/pull sync"
```

### Task 5: Account UI — onboarding step + Settings section

**Files:**
- Modify: `index.html` — `ONB_STEPS` (line ~2450), `renderOnb()`, `commitOnboarding()`, Settings renderer (search `Load demo athlete` was removed; search `renderSettings`)

- [ ] **Step 1: Add `'account'` as the new final onboarding step.** `ONB_STEPS` becomes `['welcome','weight','height','age','activity','goal','plan','account']`. In `renderOnb()` add the branch:

```js
} else if(step==='account'){
  h=`<div class="onbq">Save your progress ☁️</div>
    <div class="onbsub">Create your account — your data follows you to any device, and you join the leaderboard when friends arrive.</div>
    <label class="f">Lifter name (public, 3–20 letters/numbers)</label>
    <input id="onbUser" placeholder="e.g. ${escapeAttr((onb.name||'lifter').replace(/[^A-Za-z0-9_]/g,'')||'lifter')}" value="${escapeAttr(onb.user||'')}">
    <label class="f" style="margin-top:10px;">Email</label>
    <input id="onbEmail" type="email" placeholder="you@email.com" value="${escapeAttr(onb.email||'')}">
    <label class="f" style="margin-top:10px;">Password (8+ characters)</label>
    <input id="onbPass" type="password" placeholder="••••••••">
    <div class="tiny muted" style="margin-top:12px;">Already have an account? <b style="color:var(--accent2);cursor:pointer;" onclick="onbSignInMode()">Sign in instead</b></div>
    <div class="tiny muted" style="margin-top:6px;"><b style="cursor:pointer;" onclick="onbSkipAccount()">Skip for now</b> — keep data on this device only.</div>`;
}
```

- [ ] **Step 2: Capture + commit paths.** Extend `onbCapture()` with `onbUser/onbEmail` fields. `onbNext()` on the final step calls `commitOnboarding()` — replace its tail so:

```js
async function commitOnboarding(){
  onbCapture();
  // … existing S.name/units/bw/height/age/activity/goal assignment stays unchanged …
  S.onboarded=true; S.profileUpdatedAt=Date.now();
  const email=(onb.email||'').trim(), pass=onb.pass||document.getElementById('onbPass')?.value||'', uname=(onb.user||'').trim();
  if(email && pass && uname && cloud.configured){
    try { await cloud.signUp(email, pass, uname); cloud.queueAllLocal(); toast('Account created ☁️'); }
    catch(e){ toast(e.message&&e.message.includes('already registered')?'That email already has an account — try Sign in':'Account error: '+(e.message||'try again')); return; }
  }
  save();
  // … existing post-onboarding navigation stays …
}
```

`onbSkipAccount()` = commit without credentials (current local-only behavior). `onbSignInMode()` swaps the step's HTML for email+password+Sign-in button calling `cloud.signIn`, then `cloud.pullAll()`, then `S.onboarded=true; save();` and proceeds (a returning user skips re-answering questions because pull overwrote the profile).
- [ ] **Step 3: Settings account section.** In `renderSettings()` add rows: when signed out — "☁️ Create account / Sign in" (opens the same account UI in a sheet); when signed in — show email + lifter name, "Sync now" (`cloud.syncNow()` + toast with `cloud.pending()` before/after), and "Sign out" (`cloud.signOut()` then toast; local data stays).
- [ ] **Step 4: Verify in preview** — full signup flow: reset local state (`localStorage.clear()` in eval, reload), complete onboarding with a test account `casey+t1@…`, then Supabase Table Editor shows the `profiles` row with the username; log a workout; `sessions` row appears.
- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Phase 1: account creation/sign-in in onboarding + settings"
```

### Task 6: Deploy to GitHub Pages

**Files:** none new — repo settings + push.

- [ ] **Step 1: Enable Pages from main branch root:**

```bash
gh api repos/caseytrvsg/ascend/pages --method POST -f "source[branch]=main" -f "source[path]=/"
```

(409 = already enabled — fine.)
- [ ] **Step 2: Push everything**, wait ~2 min for the Pages build: `git push origin main`, then `gh api repos/caseytrvsg/ascend/pages --jq .status` → `built`.
- [ ] **Step 3: Verify live.** Open `https://caseytrvsg.github.io/ascend/` — app loads over HTTPS, install prompt available on phone, sign-in works, data appears on a second device signed into the same account.
- [ ] **Step 4: Commit/log** — nothing to commit; record the URL in the repo README if absent.

### Task 7: End-to-end acceptance

- [ ] **Step 1 — multi-device:** sign in on PC preview + phone; log a session on the phone; `Sync now` on PC pulls it (or reload). Session list matches.
- [ ] **Step 2 — offline:** in preview devtools set Offline → log a workout → `cloud.pending()` > 0 → back Online → pending drains to 0 → row visible in Supabase.
- [ ] **Step 3 — RLS spot-check:** in Supabase SQL editor as `anon`: `select * from profiles` → 0 rows (RLS blocks); confirms data is locked.
- [ ] **Step 4 — sign-out survival:** sign out → app still fully usable offline-local; sign back in → merge brings cloud data without duplicating sessions (unique `(user_id, started_at)` guards).

---

## Self-review (done at write time)

- **Spec coverage:** hosting ✓ (T6), accounts ✓ (T0/T5), profile+training sync ✓ (T1/T3/T4), offline-first ✓ (T4 queue), multi-device ✓ (T4 pullAll/T7), migration posture ✓ (all Supabase calls in backend.js), security/RLS ✓ (T1/T7). Phases 2–5 are separate plans.
- **Placeholder scan:** `<PROJECT_REF>`/`<ANON_KEY>` are intentional Task 0 outputs, not placeholders. One soft spot flagged inline: the exact current-screen variable name in Task 4 Step 3 must be confirmed against the file at implementation time.
- **Type consistency:** `profileToRow`/`profileFromRow`/`mergeProfile`/`mergeAppendOnly`/`ensureRids` names match between Task 3 tests, Task 3 implementation, and Task 4 usage; queue key names (`profile/sessions/meals/routines/customEx`) consistent across mark/syncNow/pending.
