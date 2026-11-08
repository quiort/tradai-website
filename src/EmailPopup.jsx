import { useEffect, useRef, useState } from 'react';
import { usePip } from './pip/PipContext.jsx';
import { isEmail, popupDue, snoozePopup, subscribe } from './emailList.js';
import { EMAIL_POPUP } from './content.js';

// Optional welcome pop-up: shows a few seconds after someone arrives, once.
export default function EmailPopup() {
  const { react, say } = usePip();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (location.pathname.startsWith('/admin') || !popupDue()) return undefined;
    const timer = setTimeout(() => setOpen(true), EMAIL_POPUP.delayMs);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() { snoozePopup(); setOpen(false); }

  function submit(e) {
    e.preventDefault();
    if (!isEmail(email)) { setError('Enter a valid email address.'); return; }
    subscribe(email, 'popup');
    setDone(true); setError('');
    react('happy', 1800); say(EMAIL_POPUP.pipThanks, 3500);
    setTimeout(() => setOpen(false), 2200);
  }

  if (!open) return null;
  return (
    <div className="dl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <div className="dl-dialog email-dialog" role="dialog" aria-modal="true" aria-labelledby="email-title">
        <button type="button" className="dl-close" aria-label="Close" onClick={dismiss}>✕</button>
        <img src="/pip.png" alt="" className="email-pip" width="64" height="64" />
        <h2 id="email-title">{done ? EMAIL_POPUP.doneTitle : EMAIL_POPUP.title}</h2>
        <p className="dl-lead">{done ? EMAIL_POPUP.doneText : EMAIL_POPUP.text}</p>
        {!done && (
          <form className="email-form" onSubmit={submit} noValidate>
            <input ref={inputRef} type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} aria-label="Email address" aria-invalid={Boolean(error)} />
            <button type="submit" className="btn btn-primary btn-sm">{EMAIL_POPUP.button}</button>
          </form>
        )}
        {error && <p className="email-error" role="alert">{error}</p>}
        {!done && <button type="button" className="email-skip" onClick={dismiss}>No thanks</button>}
      </div>
    </div>
  );
}
