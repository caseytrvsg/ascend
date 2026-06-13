// Sends the Web Push notification for a nudge. Called by the SENDER's app right
// after the nudge row is inserted. Holds the VAPID private key (secret) — this is
// the one part of notifications that must live server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

webpush.setVapidDetails(
  'mailto:faxemployee@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // Caller must be a real signed-in user…
    const authed = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return new Response('unauthorized', { status: 401, headers: CORS });

    const { nudge_id } = await req.json();
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // …and must be the sender of this exact nudge (no spoofing pushes to strangers).
    const { data: nudge } = await svc.from('nudges')
      .select('*, sender:profiles!nudges_from_user_fkey(username)').eq('id', nudge_id).single();
    if (!nudge || nudge.from_user !== user.id) return new Response('forbidden', { status: 403, headers: CORS });

    const { data: subs } = await svc.from('push_subscriptions').select('*').eq('user_id', nudge.to_user);
    let sent = 0;
    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: 'ASCEND', body: `You were nudged by ${nudge.sender?.username || 'a friend'} 👋`, tag: 'nudge' }),
        );
        sent++;
      } catch (e) {
        // Subscription died (app uninstalled / permission revoked) — prune it.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await svc.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
    return new Response(JSON.stringify({ sent }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response('error: ' + ((e as Error).message || e), { status: 500, headers: CORS });
  }
});
