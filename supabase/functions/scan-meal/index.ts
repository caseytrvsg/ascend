// AI meal recognition — the one ASCEND feature that costs money per call (a vision model reads
// the plate photo and returns foods). This runs server-side for two reasons: the AI provider key
// stays off the client, and the daily usage cap is enforced here where it can't be bypassed.
//
// Hard stop: ai_consume() raises once the per-user OR global daily cap is hit, so we return 429
// and NEVER call the paid model past the limit. Tune the caps to your budget.
//
// Deploy:  supabase functions deploy scan-meal
// Secrets: supabase secrets set AI_API_KEY=<your provider key>   (until set, the feature reports
//          'ai-not-configured' and spends nothing — no quota used)
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};
const USER_DAILY = 25;      // per account, per day
const GLOBAL_DAILY = 2000;  // whole app, per day — your spend ceiling
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // Must be a signed-in user.
    const authed = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ ok: false, reason: 'unauthorized' }, 401);

    // No provider wired yet → behave like "coming soon", and spend no quota.
    const aiKey = Deno.env.get('AI_API_KEY');
    if (!aiKey) return json({ ok: false, reason: 'ai-not-configured' });

    // Reserve one AI call against the caps BEFORE spending money. Blocked → 429, no model call.
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: remaining, error } = await svc.rpc('ai_consume',
      { p_kind: 'scan_meal', p_user_max: USER_DAILY, p_global_max: GLOBAL_DAILY });
    if (error) {
      const reason = error.hint === 'ai_global_limit' ? 'ai_global_limit'
                   : error.hint === 'ai_user_limit' ? 'ai_user_limit' : null;
      if (reason) return json({ ok: false, reason }, 429);   // ← the hard stop
      return json({ ok: false, reason: 'error' }, 500);
    }

    // --- TODO: call your vision model with the posted image and parse it into foods. ---
    //   const { image } = await req.json();
    //   const foods = await callVisionModel(aiKey, image);   // [{ name, kcal, p, c, f, confidence }]
    // The cap is already enforced above, so this stays within budget no matter what.
    const foods: unknown[] = [];

    return json({ ok: true, remaining, foods });
  } catch (e) {
    return json({ ok: false, reason: 'error', detail: (e as Error).message }, 500);
  }
});
