# ASCEND — Supabase security checklist

How to apply and **verify** the protections, step by step in the Supabase dashboard.
Project: `powdosapvcvlrhpcggqz` (dashboard → https://supabase.com/dashboard/project/powdosapvcvlrhpcggqz).

> **First principle:** the publishable key in `config.js` is *meant* to be public. It identifies
> the project, it does not authorize anything. What actually protects data is (1) Row-Level
> Security, (2) the entitlement/rate-limit triggers below, and (3) keeping the **service-role
> key** and **edge-function secrets** off the client. Never put the service-role key in the app.

---

## 1. Apply the new migrations

The two new files are `supabase/migrations/0006_security_entitlements.sql` and
`0007_rate_limits.sql`.

**Easiest (dashboard):** SQL Editor → New query → paste the contents of `0006…` → **Run**.
Repeat for `0007…`. (Both are safe to re-run — they use `if not exists` / `create or replace`
/ `drop trigger if exists`.)

**Or CLI:** `supabase db push` from the project root.

---

## 2. Verify RLS is ON for every table

Dashboard → **Authentication → Policies** (or **Table Editor**, each table shows an
`RLS enabled` badge). Every table in `public` should say **RLS enabled**:
`profiles, sessions, routines, meals, custom_exercises, friendships, nudges, posts, likes,
duels, messages, push_subscriptions, rate_limits`.

Or run this in the SQL Editor — it lists any table that is **missing** RLS (should return **0 rows**):

```sql
select tablename from pg_tables
where schemaname = 'public'
  and rowsecurity = false;
```

---

## 3. Verify the subscription can't be self-granted  ← the important one

The `profiles_guard` trigger pins `pro`, `pro_until`, and `comp` for ordinary app users.

**Quick proof, no app needed.** SQL Editor → run this. It impersonates a logged-in user and
tries to switch Pro on, exactly like a hacker with the public key would:

```sql
-- pick any real account id
select id, username, pro from public.profiles limit 1;   -- note the id

-- simulate that user's session and attempt the bypass
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','<PASTE_ID>','role','authenticated')::text, true);
  update public.profiles set pro = true, shards = 999999 where id = '<PASTE_ID>';
  select id, pro, shards from public.profiles where id = '<PASTE_ID>';
rollback;
```

Expected: **`pro` is still `false`** (the trigger reverted it) while `shards` did change
(economy is still client-side — see §6). That's the subscription bypass closed.

**Grant Pro the right way** (this is what your payment webhook will do). SQL Editor as admin:

```sql
update public.profiles
  set pro = true, pro_until = now() + interval '31 days', updated_at = (extract(epoch from now())*1000)::bigint
  where username = '<their_username>';
```

…or call the `grant-pro` edge function (§4). To revoke: `set pro = false, pro_until = null`.

---

## 4. Edge functions & secrets

Functions: `push-nudge`, `resolve-duel`, `grant-pro` (new).

Deploy: `supabase functions deploy grant-pro` (and the others if not already deployed).

Dashboard → **Edge Functions → Secrets** (or `supabase secrets set NAME=value`). Required:

| Secret | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | all | auto-provided by the platform |
| `SUPABASE_SERVICE_ROLE_KEY` | all | auto-provided; **never** ship to the client |
| `SUPABASE_ANON_KEY` | resolve-duel | auto-provided |
| `VAPID_PRIVATE_KEY` | push-nudge | private half of the web-push keypair |
| `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | push-nudge | public key matches `config.js`; subject = `mailto:you@…` |
| `GRANT_PRO_SECRET` | grant-pro | long random string; only your webhook knows it |

Generate the Pro secret: `openssl rand -hex 32`.

Test grant-pro (replace placeholders):

```bash
curl -X POST "https://powdosapvcvlrhpcggqz.supabase.co/functions/v1/grant-pro" \
  -H "x-grant-secret: $GRANT_PRO_SECRET" -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","days":31}'
```

Wrong/blank secret must return **403**.

---

## 5. Verify rate limiting

After `0007`, every account has per-action write caps (nudge 30/h, message 180/h, post 60/h,
like 600/h, friend-request 60/h, duel 60/h, custom-exercise 60/day, sessions 600/h, meals 800/h).

Watch it work: **Table Editor → `rate_limits`** — rows appear (`user_id, action, count`) as you
use the app; `count` climbs and resets each window. Going over raises
`rate limit exceeded …` and the insert is rejected.

To change a cap, edit the numbers in the matching `rl_*` function in `0007` and re-run that
function block. To reset someone mid-test: `delete from public.rate_limits where action = 'nudge';`

---

## 5b. AI usage caps (so AI features stop at a hard limit)

`migrations/0008_ai_quota.sql` + the `scan-meal` edge function cap the only cost-bearing
feature (AI meal recognition). Two ceilings, enforced **server-side** where they can't be
bypassed: **per-user 25/day** and **GLOBAL 2000/day** (your total spend limit). Hit either and
the function returns `429` and never calls the paid model — the in-app button switches to
"Daily AI limit reached" / "AI unavailable today". Math-only AI (calorie/macro plan) and barcode
lookup (free OpenFoodFacts) are unaffected.

Apply `0008…` (SQL Editor), then `supabase functions deploy scan-meal`. Until you set the
provider key the feature is dormant and spends nothing:

```
supabase secrets set AI_API_KEY=<your vision-model key>
```

Tune the caps to your budget: edit `USER_DAILY` / `GLOBAL_DAILY` at the top of
`supabase/functions/scan-meal/index.ts` and redeploy. Wire the real model where the
`// TODO: call your vision model` comment is — the cap already wraps it.

Watch usage: **Table Editor → `ai_usage`** (`scope='GLOBAL'` is the whole-app daily total;
a uuid scope is one user). Counts settle exactly at the cap — a blocked call rolls back, so
it's never counted or charged.

## 6. Known, intentional gaps (decide when you monetize)

- **Shards / owned / inv are still client-trusted.** A determined user can give themselves
  cosmetics. They **cannot** get the paid subscription (that's §3). When real-money shard packs
  go live, move the economy server-side: an RPC per earn/spend that writes shards under the
  service role, then add `shards/owned/inv` to the `profiles_guard` lock.
- **Leaderboard `sr` is client-reported.** Vanity only. To make it honest, compute `sr` from the
  `sessions` table server-side (a SQL function or scheduled job) and add `sr` to the guard.
- **Profile reads expose all columns to any signed-in user** (the `profiles read … using(true)`
  policy, needed for friend search/leaderboard). Today the client only selects safe columns, but
  a hand-written query could read others' `age`/`bw`/`body_fat`. To close: restrict that policy to
  own-row + friends and serve search/leaderboard from a `directory` view exposing only
  `id, username, sr`. (Deferred because it interacts with pending-friend-request display — do it
  with the monetization pass.)

---

## 7. Auth hygiene (one-time)

- **Authentication → Providers → Email:** if "Confirm email" is **on**, signups need a working
  SMTP sender or the confirmation mail never arrives (the app surfaces this as `confirm-email-on`).
  For testing, either turn it off or configure SMTP.
- **Authentication → URL Configuration:** add `https://caseytrvsg.github.io` to the allowed
  redirect/site URLs.
- Confirm the **service-role key** appears nowhere in the repo: `git grep -n "service_role"`
  should only match `Deno.env.get(...)` inside `supabase/functions/**`.
