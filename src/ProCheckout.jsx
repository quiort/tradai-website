import { useCallback, useEffect, useRef, useState } from 'react';
import { usePip } from './pip/PipContext.jsx';

// Same crypto checkout as the app (src/payment.js in tradAI2): plans, wallets and
// contact come from payment.json in the public releases repo, which the owner edits
// from the app's admin panel. Changing it there updates the app and this site.
const PAYMENT_URL = 'https://raw.githubusercontent.com/quiort/tradAII-release/main/payment.json';
export const OPEN_PRO_EVENT = 'tradai:open-pro';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// Lenient port of the app's normalizePayment: drops bad entries instead of throwing.
function normalizePayment(raw = {}) {
  const wallets = (Array.isArray(raw.wallets) ? raw.wallets : []).slice(0, 20).map((w) => ({
    label: clean(w?.label, 40) || clean(w?.network, 40),
    network: clean(w?.network, 40),
    address: clean(w?.address, 200).replace(/\s+/g, ''),
    note: clean(w?.note, 160),
  })).filter((w) => w.label && /^[A-Za-z0-9:_.-]{10,200}$/.test(w.address));
  const plans = (Array.isArray(raw.plans) ? raw.plans : []).slice(0, 10).map((p, i) => ({
    id: clean(p?.id, 24) || `plan${i + 1}`,
    label: clean(p?.label, 40),
    price: Math.round(Number(p?.price) * 100) / 100,
    months: Math.round(Number(p?.months)),
    currency: clean(p?.currency, 10).toUpperCase() || 'USDT',
  })).filter((p) => p.label && p.price > 0 && p.months > 0);
  const telegram = clean(raw.contact?.telegram, 40).replace(/^@/, '').replace(/^(?:https?:\/\/)?t\.me\//i, '');
  const email = clean(raw.contact?.email, 120);
  return {
    wallets,
    plans,
    contact: {
      telegram: /^[A-Za-z0-9_]{4,32}$/.test(telegram) ? telegram : '',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    },
    instructions: clean(raw.instructions, 400),
  };
}

// Identical wording to the app's proofMessage, so the owner sees one format.
function proofMessage({ plan, wallet, txId, email }) {
  return [
    'TradAI Pro payment',
    `Plan: ${plan?.label || '—'} (${plan ? `${plan.price} ${plan.currency}` : '—'})`,
    `Paid with: ${wallet?.label || '—'}${wallet?.network ? ` · ${wallet.network}` : ''}`,
    `Transaction ID: ${clean(txId, 200) || '—'}`,
    `My TradAI email: ${clean(email, 120) || '—'}`,
  ].join('\n');
}

export default function ProCheckout() {
  const { react, say } = usePip();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [planId, setPlanId] = useState('');
  const [walletIdx, setWalletIdx] = useState(0);
  const [txId, setTxId] = useState('');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const opener = useRef(null);

  const close = useCallback(() => { setOpen(false); opener.current?.focus?.(); }, []);

  useEffect(() => {
    async function onOpen() {
      opener.current = document.activeElement;
      setOpen(true);
      setError('');
      try {
        const res = await fetch(`${PAYMENT_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = normalizePayment(await res.json());
        if (!data.plans.length || !data.wallets.length) throw new Error('empty');
        setConfig(data);
        setPlanId((id) => id || data.plans[0].id);
      } catch {
        setError('Pro checkout is opening soon. You can download TradAI free and use the free plan now.');
      }
    }
    window.addEventListener(OPEN_PRO_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PRO_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, close]);

  if (!open) return null;

  const plan = config?.plans.find((p) => p.id === planId) || config?.plans[0];
  const wallet = config?.wallets[walletIdx] || config?.wallets[0];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = Boolean(plan && wallet && txId.trim().length >= 8 && emailOk);
  const message = proofMessage({ plan, wallet, txId, email });

  async function copyAddress() {
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* user can select the address text manually */ }
  }
  function sent() { react('excited', 1800); say('Thanks! Your Pro key is on its way once the payment is checked.', 4000); }

  return (
    <div className="dl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dl-dialog pro-dialog" role="dialog" aria-modal="true" aria-labelledby="pro-title">
        <button type="button" className="dl-close" aria-label="Close" onClick={close}>✕</button>
        <h2 id="pro-title">Get TradAI Pro</h2>
        <p className="dl-lead">Pay with crypto. You get a Pro key for the email you use in TradAI.</p>

        {error && <p className="dl-status">{error}</p>}
        {!config && !error && <p className="dl-status muted">Loading payment details…</p>}

        {config && (
          <>
            <div className="pro-step"><span>1</span>Choose a plan</div>
            <div className="pro-options">
              {config.plans.map((p) => (
                <button key={p.id} type="button" className={`pro-option${p.id === plan.id ? ' is-on' : ''}`} onClick={() => setPlanId(p.id)} aria-pressed={p.id === plan.id}>
                  <strong>{p.label}</strong>
                  <small>{p.price} {p.currency} · {p.months} month{p.months > 1 ? 's' : ''}</small>
                </button>
              ))}
            </div>

            <div className="pro-step"><span>2</span>Send {plan.price} {plan.currency} to this wallet</div>
            <div className="pro-options">
              {config.wallets.map((w, i) => (
                <button key={`${w.label}-${i}`} type="button" className={`pro-chip${i === walletIdx ? ' is-on' : ''}`} onClick={() => setWalletIdx(i)} aria-pressed={i === walletIdx}>{w.label}</button>
              ))}
            </div>
            <div className="pro-address">
              <code>{wallet.address}</code>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copyAddress}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p className="pro-note">
              {wallet.network ? `Network: ${wallet.network}. ` : ''}{wallet.note || 'Send only on this network, or the payment can be lost.'}
            </p>
            {config.instructions && <p className="pro-note">{config.instructions}</p>}

            <div className="pro-step"><span>3</span>Send your proof</div>
            <label className="pro-field" htmlFor="pro-tx">Transaction ID (TxID / hash)
              <input id="pro-tx" type="text" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="Paste it from your wallet or exchange" autoComplete="off" />
            </label>
            <label className="pro-field" htmlFor="pro-email">Email you use in TradAI
              <input id="pro-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </label>
            <div className="pro-send">
              {config.contact.telegram && (
                <a className={`btn btn-primary${ready ? '' : ' is-disabled'}`} aria-disabled={!ready} target="_blank" rel="noopener noreferrer"
                  href={ready ? `https://t.me/${config.contact.telegram}?text=${encodeURIComponent(message)}` : undefined} onClick={ready ? sent : (e) => e.preventDefault()}>
                  Send on Telegram
                </a>
              )}
              {config.contact.email && (
                <a className={`btn btn-ghost${ready ? '' : ' is-disabled'}`} aria-disabled={!ready}
                  href={ready ? `mailto:${config.contact.email}?subject=${encodeURIComponent('TradAI Pro payment')}&body=${encodeURIComponent(message)}` : undefined} onClick={ready ? sent : (e) => e.preventDefault()}>
                  Send by email
                </a>
              )}
            </div>
            {!ready && <p className="pro-note">Fill in the transaction ID and your TradAI email to send.</p>}
            {config.contact.email && <p className="pro-note">Email: <span className="pro-select">{config.contact.email}</span></p>}
          </>
        )}
      </div>
    </div>
  );
}
