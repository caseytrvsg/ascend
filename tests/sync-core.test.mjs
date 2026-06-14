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

test('client never writes server-authoritative entitlement columns', () => {
  const S = { pro:true, comp:{ tier:9 }, shards:99999, bw:185 };
  const row = C.profileToRow(S, 1);
  assert.equal('pro' in row, false);        // subscription is server-only (grant-pro)
  assert.equal('pro_until' in row, false);
  assert.equal('comp' in row, false);       // competitive rank is server-only (resolve-duel)
  assert.equal(row.shards, 99999);          // economy still client-synced (documented)
});

test('proActive honors server flag + expiry, ignores client wishes', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past   = new Date(Date.now() - 86400000).toISOString();
  assert.equal(C.profileFromRow({ pro:true,  pro_until:null   }).pro, true);
  assert.equal(C.profileFromRow({ pro:true,  pro_until:future }).pro, true);
  assert.equal(C.profileFromRow({ pro:true,  pro_until:past   }).pro, false);  // expired
  assert.equal(C.profileFromRow({ pro:false, pro_until:null   }).pro, false);  // not granted
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
