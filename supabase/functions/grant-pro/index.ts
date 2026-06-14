// Grant (or revoke) ASCEND Pro — the ONLY sanctioned way the `pro` flag gets set, because
// the profiles_guard trigger blocks ordinary clients from writing it. Runs with the service
// role so it can update any user's row.
//
// In production your payment provider calls this AFTER verifying a receipt:
//   App Store Server Notifications / Google Play RTDN / Stripe webhook / RevenueCat webhook
//   → verify the signature & receipt there, then POST here with the user_id + entitlement.
// The shared secret (GRANT_PRO_SECRET) makes sure only your backend/webhook can call it —
// never the app, never a stranger with the public key.
//
// Deploy:  supabase functions deploy grant-pro
// Secrets: supabase secrets set GRANT_PRO_SECRET=<long-random-string>
//          (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform)
//
// Manual test (replace placeholders):
//   curl -X POST "$URL/functions/v1/grant-pro" \
//     -H "x-grant-secret: $GRANT_PRO_SECRET" -H "Content-Type: application/json" \
//     -d '{"user_id":"<uuid>","days":31}'
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-grant-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // Auth = shared secret in a header. Constant work regardless of match (don't leak via timing branches).
    const secret = Deno.env.get('GRANT_PRO_SECRET') || '';
    const given = req.headers.get('x-grant-secret') || '';
    if (!secret || given !== secret) {
      return new Response('forbidden', { status: 403, headers: CORS });
    }

    const { user_id, days, active } = await req.json();
    if (!user_id) return new Response('user_id required', { status: 400, headers: CORS });

    const on = active === false ? false : true;           // pass {active:false} to revoke
    const pro_until = on && days ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null;

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await svc.from('profiles')
      .update({ pro: on, pro_until, updated_at: Date.now() })   // bump updated_at so the client's sync pulls it
      .eq('id', user_id);
    if (error) return new Response('error: ' + error.message, { status: 500, headers: CORS });

    return new Response(JSON.stringify({ ok: true, user_id, pro: on, pro_until }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response('error: ' + ((e as Error).message || e), { status: 500, headers: CORS });
  }
});
