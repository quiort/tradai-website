// Sends anonymous usage events to the TradAI database (Supabase).
// The publishable key can only call log_event(); it cannot read anything.
// IP address and country are added by the server from the request itself.
export const SUPABASE_URL = 'https://xbcwdjzeawglawxaxxwa.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_5NqNnCXODwlpSh-M9yAocg_h8mOb5fd';

export function track(kind, extra = {}) {
  try {
    const body = {
      p_kind: kind,
      p_source: 'web',
      p_page: location.pathname + location.hash,
      p_referrer: document.referrer || null,
      p_platform: navigator.userAgentData?.platform || navigator.platform || null,
      p_email: extra.email || null,
      p_meta: extra.meta || {},
    };
    fetch(`${SUPABASE_URL}/rest/v1/rpc/log_event`, {
      method: 'POST',
      keepalive: true, // still sends if the page is navigating to a download
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => { /* tracking must never break the site */ });
  } catch { /* ignore */ }
}

/** One "visit" per browser tab session. */
export function trackVisit() {
  try {
    if (sessionStorage.getItem('tradai-visit')) return;
    sessionStorage.setItem('tradai-visit', '1');
  } catch { /* storage blocked: still count it */ }
  const params = new URLSearchParams(location.search);
  track('visit', { meta: { utm_source: params.get('utm_source') || undefined, utm_campaign: params.get('utm_campaign') || undefined } });
}
