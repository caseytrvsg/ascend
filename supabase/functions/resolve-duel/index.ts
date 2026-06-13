// Resolves a duel once both lifters have submitted: picks the winner (heaviest lift),
// applies SR to BOTH players' competitive rank, and records the result. Runs with the
// service role because a player can't write their opponent's profile under RLS.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};
const MAX_TIER = 8;   // RANKS.length - 1 (Wood…Ascended)

type Comp = { tier: number; div: number; sr: number; wins: number; losses: number; streak: number };
function applyResult(comp: Comp, delta: number, won: boolean): Comp {
  const c: Comp = { tier: comp.tier|0, div: comp.div|0, sr: comp.sr|0, wins: comp.wins|0, losses: comp.losses|0, streak: comp.streak|0 };
  c.sr += delta;
  while (c.sr >= 100) { c.sr -= 100; if (c.div < 2) c.div++; else if (c.tier < MAX_TIER) { c.tier++; c.div = 0; } else { c.div = 2; c.sr = 100; break; } }
  while (c.sr < 0) { if (c.div > 0) { c.div--; c.sr += 100; } else if (c.tier > 0) { c.tier--; c.div = 2; c.sr += 100; } else { c.sr = 0; break; } }
  if (won) { c.wins++; c.streak = c.streak > 0 ? c.streak + 1 : 1; }
  else { c.losses++; c.streak = c.streak < 0 ? c.streak - 1 : -1; }
  return c;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authed = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return new Response('unauthorized', { status: 401, headers: CORS });

    const { duel_id } = await req.json();
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: d } = await svc.from('duels').select('*').eq('id', duel_id).single();
    if (!d) return new Response('not found', { status: 404, headers: CORS });
    if (user.id !== d.challenger && user.id !== d.opponent) return new Response('forbidden', { status: 403, headers: CORS });

    // Only resolve once, and only when both lifts are in.
    if (d.status !== 'active' || d.winner || d.c_weight == null || d.o_weight == null) {
      return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const cWon = Number(d.c_weight) > Number(d.o_weight);
    const oWon = Number(d.o_weight) > Number(d.c_weight);
    const tie = !cWon && !oWon;
    const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
    const gain = rnd(18, 26), loss = rnd(15, 22);

    const ids = [d.challenger, d.opponent];
    const { data: profs } = await svc.from('profiles').select('id,comp').in('id', ids);
    const compOf = (id: string) => (profs?.find(p => p.id === id)?.comp) || { tier:0, div:0, sr:0, wins:0, losses:0, streak:0 };

    let cDelta = 0, oDelta = 0, winner: string | null = null;
    let cComp = compOf(d.challenger), oComp = compOf(d.opponent);
    if (tie) {
      cComp = applyResult(cComp, 0, false); cComp.losses--;   // tie: no win/loss recorded
      oComp = applyResult(oComp, 0, false); oComp.losses--;
      cComp.streak = 0; oComp.streak = 0;
    } else if (cWon) {
      cDelta = gain; oDelta = -loss; winner = d.challenger;
      cComp = applyResult(cComp, gain, true); oComp = applyResult(oComp, -loss, false);
    } else {
      cDelta = -loss; oDelta = gain; winner = d.opponent;
      cComp = applyResult(cComp, -loss, false); oComp = applyResult(oComp, gain, true);
    }

    await svc.from('profiles').update({ comp: cComp }).eq('id', d.challenger);
    await svc.from('profiles').update({ comp: oComp }).eq('id', d.opponent);
    await svc.from('duels').update({ status: 'done', winner, c_delta: cDelta, o_delta: oDelta }).eq('id', duel_id);

    return new Response(JSON.stringify({ ok: true, winner, cDelta, oDelta }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response('error: ' + ((e as Error).message || e), { status: 500, headers: CORS });
  }
});
