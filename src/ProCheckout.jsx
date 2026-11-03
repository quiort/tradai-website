import { useCallback, useEffect, useRef, useState } from 'react';
import { usePip } from './pip/PipContext.jsx';

// Same checkout as the app (src/payment.js in tradAI2). Plans, wallets, OxaPay links and
// contacts come from payment.json in the public releases repo, which the owner edits in the
// app's Admin panel. OxaPay plans pay on OxaPay; the buyer then sends the payment ID to the
// payment bot, which checks it and replies with the Pro key.
const PAYMENT_URL = 'https://raw.githubusercontent.com/quiort/tradAII-release/main/payment.json';
export const OPEN_PRO_EVENT = 'tradai:open-pro';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const handle = (v) => clean(v, 40).replace(/^@/, '').replace(/^(?:https?:\/\/)?t\.me\//i, '').replace(/\/.*$/, '');
const validHandle = (v) => (/^[A-Za-z0-9_]{4,32}$/.test(v) ? v : '');
const OXAPAY_LINK = /^https:\/\/(?:[a-z0-9-]+\.)*oxapay\.com\/[^\s]*$/i;

// Lenient port of the app's normalizePayment: drops bad entries instead of throwing.
function normalizePayment(raw = {}) {
  const wallets = (Array.isArray(raw.wallets) ? raw.wallets : []).slice(0, 20).map((w) => ({
    label: clean(w?.label, 40) || clean(w?.network, 40),
    network: clean(w?.network, 40),
    address: clean(w?.address, 200).replace(/\s+/g, ''),
    note: clean(w?.note, 160),
    chain: clean(w?.chain, 20),
  })).filter((w) => w.label && /^[A-Za-z0-9:_.-]{10,200}$/.test(w.address));
  const plans = (Array.isArray(raw.plans) ? raw.plans : []).slice(0, 10).map((p, i) => ({
    id: clean(p?.id, 24) || `plan${i + 1}`,
    label: clean(p?.label, 40),
    price: Math.round(Number(p?.price) * 100) / 100,
    months: Math.round(Number(p?.months)),
    currency: clean(p?.currency, 10).toUpperCase() || 'USDT',
    oxapayLink: OXAPAY_LINK.test(clean(p?.oxapayLink, 300)) ? clean(p?.oxapayLink, 300) : '',
  })).filter((p) => p.label && p.price > 0 && p.months > 0);
  const email = clean(raw.contact?.email, 120);
  return {
    wallets,
    plans,
    contact: {
      telegram: validHandle(handle(raw.contact?.telegram)),
      bot: validHandle(handle(raw.contact?.bot)),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    },
    instructions: clean(raw.instructions, 400),
  };
}

// Same wording as the app, so the owner and the bot see one format.
function proofMessage({ plan, wallet, txId, email, provider }) {
  return [
    'TradAI Pro payment',
    `Plan: ${plan?.label || '—'} (${plan ? `${plan.price} ${plan.currency}` : '—'})`,
    provider === 'oxapay' ? 'Paid with: OxaPay' : `Paid with: ${wallet?.label || '—'}${wallet?.network ? ` · ${wallet.network}` : ''}`,
    provider === 'oxapay' ? `OxaPay payment ID: ${clean(txId, 200) || '—'}` : `Transaction ID: ${clean(txId, 200) || '—'}`,
    `My TradAI email: ${clean(email, 120) || '—'}`,
  ].join('\n');
}
// The bot parses these keys; keep them identical to the app's botProofMessage.
function botProofMessage({ plan, wallet, txId, email, provider }) {
  const lines = ['/paid', `provider: ${provider === 'oxapay' ? 'oxapay' : 'chain'}`, `plan: ${plan?.id || ''}`];
  if (provider === 'oxapay') lines.push('track: ', `tx: ${clean(txId, 200)}`);
  else lines.push(`to: ${wallet?.address || ''}`, `chain: ${wallet?.chain || ''}`, `tx: ${clean(txId, 200)}`);
  lines.push(`email: ${clean(email, 120)}`);
  return lines.join('\n');
}

export default function ProCheckout() {
  const { react, say } = usePip();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState('oxapay');
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
        const payable = data.plans.some((p) => p.oxapayLink) || data.wallets.length;
        if (!data.plans.length || !payable) throw new Error('empty');
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
  const canOxapay = Boolean(plan?.oxapayLink);
  const canWallet = Boolean(config?.wallets.length);
  const provider = canOxapay && (method === 'oxapay' || !canWallet) ? 'oxapay' : 'chain';
  const wallet = config?.wallets[walletIdx] || config?.wallets[0];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = Boolean(plan && (provider === 'oxapay' || wallet) && txId.trim().length >= 8 && emailOk);
  const contact = config?.contact || {};
  const human = proofMessage({ plan, wallet, txId, email, provider });
  const botText = botProofMessage({ plan, wallet, txId, email, provider });

  async function copyAddress() {
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* the address text is selectable as a fallback */ }
  }
  function sent() { react('excited', 1800); say('Thanks! Your Pro key is on its way.', 4000); }
  const guard = (e) => { if (!ready) e.preventDefault(); else sent(); };

  return (
    <div className="dl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dl-dialog pro-dialog" role="dialog" aria-modal="true" aria-labelledby="pro-title">
        <button type="button" className="dl-close" aria-label="Close" onClick={close}>✕</button>
        <h2 id="pro-title">Get TradAI Pro</h2>
        <p className="dl-lead">Pay with crypto. You get a Pro key for the email you use in TradAI.</p>

        {error && <p className="dl-status">{error}</p>}
        {!config && !error && <p className="dl-status muted">Loading payment details…</p>}

        {config && plan && (
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

            <div className="pro-step"><span>2</span>Pay {plan.price} {plan.currency}</div>
            {canOxapay && canWallet && (
              <div className="pro-options">
                <button type="button" className={`pro-chip${provider === 'oxapay' ? ' is-on' : ''}`} onClick={() => setMethod('oxapay')}>Any crypto (OxaPay)</button>
                <button type="button" className={`pro-chip${provider === 'chain' ? ' is-on' : ''}`} onClick={() => setMethod('chain')}>Send to wallet</button>
              </div>
            )}

            {provider === 'oxapay' ? (
              <>
                <a className="btn btn-primary pro-oxapay" href={plan.oxapayLink} target="_blank" rel="noopener noreferrer">Open the OxaPay checkout</a>
                <p className="pro-note">Pay with any coin and network OxaPay offers. When it's done, copy the payment or transaction ID from the OxaPay page.</p>
              </>
            ) : (
              <>
                <div className="pro-options">
                  {config.wallets.map((w, i) => (
                    <button key={`${w.label}-${i}`} type="button" className={`pro-chip${i === walletIdx ? ' is-on' : ''}`} onClick={() => setWalletIdx(i)} aria-pressed={i === walletIdx}>{w.label}</button>
                  ))}
                </div>
                <div className="pro-address">
                  <code>{wallet.address}</code>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={copyAddress}>{copied ? 'Copied' : 'Copy'}</button>
                </div>
                <p className="pro-note">{wallet.network ? `Network: ${wallet.network}. ` : ''}{wallet.note || 'Send only on this network, or the payment can be lost.'}</p>
              </>
            )}
            {config.instructions && <p className="pro-note">{config.instructions}</p>}

            <div className="pro-step"><span>3</span>Get your Pro key</div>
            <label className="pro-field" htmlFor="pro-tx">{provider === 'oxapay' ? 'OxaPay payment / transaction ID' : 'Transaction ID (TxID / hash)'}
              <input id="pro-tx" type="text" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="Paste it here" autoComplete="off" />
            </label>
            <label className="pro-field" htmlFor="pro-email">Email you use in TradAI
              <input id="pro-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </label>
            <div className="pro-send">
              {contact.bot && (
                <a className={`btn btn-primary${ready ? '' : ' is-disabled'}`} aria-disabled={!ready} target="_blank" rel="noopener noreferrer"
                  href={ready ? `https://t.me/${contact.bot}?text=${encodeURIComponent(botText)}` : undefined} onClick={guard}>
                  Send to @{contact.bot} · automatic
                </a>
              )}
              {!contact.bot && contact.telegram && (
                <a className={`btn btn-primary${ready ? '' : ' is-disabled'}`} aria-disabled={!ready} target="_blank" rel="noopener noreferrer"
                  href={ready ? `https://t.me/${contact.telegram}?text=${encodeURIComponent(human)}` : undefined} onClick={guard}>
                  Send on Telegram
                </a>
              )}
              {contact.email && (
                <a className={`btn btn-ghost${ready ? '' : ' is-disabled'}`} aria-disabled={!ready}
                  href={ready ? `mailto:${contact.email}?subject=${encodeURIComponent('TradAI Pro payment')}&body=${encodeURIComponent(human)}` : undefined} onClick={guard}>
                  Send by email
                </a>
              )}
            </div>
            {!ready && <p className="pro-note">Fill in the ID and your TradAI email to send.</p>}
          </>
        )}
      </div>
    </div>
  );
}
