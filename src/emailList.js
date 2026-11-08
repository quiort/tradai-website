// Email list. Every address is saved to the TradAI database through log_event()
// (kind "signup", source "web", meta.list = where it came from), so it needs no
// extra setup. The admin panel's "Emails" tab lists them and exports a CSV.
import { track } from './track.js';

const KEY = 'tradai-email';
const POPUP_KEY = 'tradai-email-popup';

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

export function savedEmail() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

/** Saves the address (once per address and list on this browser). */
export function subscribe(email, list) {
  const clean = String(email || '').trim().toLowerCase();
  if (!isEmail(clean)) return false;
  let sent = '';
  try { sent = localStorage.getItem(`${KEY}-${list}`) || ''; } catch { /* ignore */ }
  if (sent !== clean) track('signup', { email: clean, meta: { list } });
  try { localStorage.setItem(KEY, clean); localStorage.setItem(`${KEY}-${list}`, clean); } catch { /* ignore */ }
  return true;
}

/** The welcome pop-up shows once; "No thanks" hides it for 14 days. */
export function popupDue() {
  if (savedEmail()) return false;
  try { const until = Number(localStorage.getItem(POPUP_KEY) || 0); return Date.now() > until; } catch { return true; }
}
export function snoozePopup(days = 14) {
  try { localStorage.setItem(POPUP_KEY, String(Date.now() + days * 86400000)); } catch { /* ignore */ }
}
