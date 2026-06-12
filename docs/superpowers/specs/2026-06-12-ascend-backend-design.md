# ASCEND Backend — Design Spec

**Date:** 2026-06-12
**Status:** Approved by Casey (systems design) — pending implementation plan
**Owner:** Casey (caseytrvsg) with Kaizen Agent

## What we're building

A full backend for ASCEND so every system runs on real user data: accounts, cloud-saved
training data, live leaderboards, a real social feed, friends/nudges/challenges, 1v1 duels,
and direct-message chat. Today the app is a single-file PWA backed only by localStorage;
all multiplayer surfaces show honest empty states (fake data was removed 2026-06-12).

## Audience & scale

Private circle: Casey + friends testing (~5–50 people). Not a public launch — no
moderation tooling, rate limiting beyond service defaults, or abuse handling in scope yet.
Decisions below intentionally trade big-company hardening for speed.

## Stack

- **Backend:** Supabase free tier — Postgres database, email+password auth, realtime
  subscriptions, file storage. Chosen over Firebase (SQL fits leaderboards; less lock-in)
  and over a custom server (no auth security to hand-roll, no server to maintain, $0).
- **App hosting:** GitHub Pages at `https://caseytrvsg.github.io/ascend` — free, HTTPS
  (required for PWA install + secure auth), deploys from the existing repo.
- **Migration posture:** Casey may move to a self-hosted server later. Therefore ALL
  Supabase calls live in one data-layer file (`backend.js`); the rest of the app calls
  functions like `saveSession()` / `getLeaderboard()` and never touches Supabase directly.
  A future migration replaces `backend.js` only.

**Known caveat (accepted):** Supabase free projects pause after ~7 days of zero traffic
and need a manual dashboard unpause. Daily gym use makes this unlikely in practice.

## Architecture

```
phone / PC browser
  └─ ASCEND PWA (GitHub Pages)
       ├─ localStorage  ← instant reads, offline writes (source of truth for UI)
       └─ backend.js    ← sync queue + all Supabase calls
            └─ Supabase: auth · Postgres (+ row-level security) · realtime · storage
```

**Offline-first sync.** The app keeps working with no signal (logging a workout in a
basement gym). Writes land in localStorage immediately and join a pending-sync queue;
the queue flushes whenever the device is online. Merge rules:

- **Sessions, posts, messages, meals:** append-only — new rows are inserted, never
  overwritten, so multi-device merge is conflict-free.
- **Profile/settings (bodyweight, units, theme, etc.):** last write wins.
- **Derived numbers (SR, streaks):** recomputed from synced history, then cached on the
  profile row so leaderboards are a cheap query.

## Data model (tables)

| Table | Purpose | Key fields |
|---|---|---|
| `profiles` | One row per account | auth uid, unique username, bw, units, height, age, sex, activity, goal, calories, pro, shards, owned items, theme/border/banner, streak state, current SR, comp record (tier/div/sr/wins/losses/streak) |
| `sessions` | Workout history | user_id, started_at, ended_at, exercises (JSON) |
| `routines` | Saved routines | user_id, name, items (JSON) |
| `meals` | Food log | user_id, day, entry (JSON) |
| `custom_exercises` | User-created lifts | user_id, name, muscle group, equipment |
| `posts` | Feed | user_id, type (post/rankup/pr/workout), payload (JSON), media path, created_at |
| `likes` | Feed likes | post_id, user_id (unique pair) |
| `friendships` | Friend graph | user_a, user_b, status (pending/accepted), requested_by |
| `nudges` | Pokes | from, to, message, seen |
| `challenges` | Duel requests | from, to, exercise, status (pending/accepted/declined/done) |
| `duels` | Duel results | challenge_id, per-side weight + proof-photo path, winner, SR delta |
| `messages` | Chat | from, to, text or routine (JSON), created_at |

**Storage buckets:** `proof-photos` (duels) and `post-media` (feed) — private; access via
short-lived signed URLs, never public links.

## Systems

**Accounts.** Onboarding becomes sign-up: email, password, unique lifter name. Supabase
auth handles password security, sessions, and password-reset emails. Stays signed in per
device.

**Leaderboard.** Query of `profiles` ordered by cached SR. Scopes: Global = all users,
Friends = accepted friendships. The Local scope chip is hidden until regions are
meaningful.

**Feed.** Real posts; user shares plus auto-posts on rank-up and PR (generated client-side
when the event happens, written like any post). Likes are live (realtime subscription).
Comments are deferred entirely — no table, no UI — until there's real demand.

**Friends.** Request by lifter name → accept/decline. Nudges insert a row; the friend's
app shows it on next load (realtime if the app is open).

**Challenges & duels.** Challenge inserts a row; the opponent accepts to create a duel.
Each side submits weight + proof photo. Winner computed when both sides are in; if only
one side has submitted after 48 hours, the submitter wins by default. SR delta applied to
both `profiles.comp`. Trust model: friends-circle honor
system + photo proof — no anti-cheat referee in scope.

**Chat.** `messages` table + realtime subscription for live delivery. Routine-share cards
(already built in the UI) send the routine JSON in the message row.

**Real scanning (replaces today's simulated scans).** Both scanners open a live camera
viewfinder (`getUserMedia`, rear camera; requires HTTPS — works on localhost dev and the
GitHub Pages deploy, NOT over LAN HTTP).
- *Barcode:* decoded on-device in real time — native `BarcodeDetector` where available,
  bundled JS fallback library elsewhere (vendored into the repo so it works offline) —
  then looked up in the free Open Food Facts database for label-exact macros. Unknown
  barcodes fall back to manual food search. Lookup needs internet; scans queue nothing.
- *Meal photo:* live viewfinder → snap frame → sent to a Supabase Edge Function
  (`scan-meal`) that calls an AI vision model with a server-held key and returns detected
  foods + estimated portions into the existing editable results sheet. Costs ~1–2¢ per
  scan; requires an AI provider account (Casey's call on when to enable — barcode scanner
  ships first and does not depend on this).

**Security.** Row-level security on every table: only you write your rows; reads limited
to what the feature needs (e.g., messages visible only to the two participants; profiles
readable by all signed-in users for leaderboards). The publishable API key in the app is
safe to expose by design — RLS is the lock, not the key.

## Build order (each phase ships usable)

1. **Phase 1 — Live app + accounts + cloud save:** GitHub Pages deploy, sign-up/sign-in,
   profile + training data sync, multi-device. Friends can install and train.
2. **Phase 2 — Real scanners:** live-camera barcode scanner + Open Food Facts lookup;
   AI meal scan via `scan-meal` Edge Function (enabled when Casey OKs the AI account).
3. **Phase 3 — Friends + leaderboard:** friend requests, real rankings.
4. **Phase 4 — Feed:** posts, likes, rank-up/PR auto-posts.
5. **Phase 5 — Compete + chat:** challenges, duels with proof photos, SR exchange, DMs.

Runs alongside (independent of backend): the visual/UI quality pass — custom SVG
iconography replacing emoji, rank-screen drama (emblem art, glow, animation), spacing/
typography polish, illustrated empty states.

## Out of scope (deliberate)

Public-launch hardening (moderation, abuse, rate limits), comment UI, Local/regional
leaderboards, native app-store builds, anti-cheat verification of lifts.

## Prerequisites

- Casey creates a free Supabase account (sign in with GitHub at supabase.com) — needed at
  Phase 1; everything else is automated from this machine.
- An AI provider account for the meal scanner (~1–2¢/scan) — needed only to switch on the
  AI half of Phase 2; barcode scanning works without it.
