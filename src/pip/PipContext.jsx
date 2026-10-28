import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DOWNLOAD_URL } from '../content.js';
import { fetchBinance } from '../market.js';

const SLEEP_AFTER_MS = 25000;
const MARKET_REFRESH_MS = 120000;
const WORRIED_BELOW_PCT = -3;
const BTC_TICKER_PATH = '/api/v3/ticker/24hr?symbol=BTCUSDT';

// localStorage can throw (private mode, blocked site data) — never let it break the page.
const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* ignore */ } },
};

const PipContext = createContext(null);

export function usePip() {
  const ctx = useContext(PipContext);
  if (!ctx) throw new Error('usePip must be used inside <PipProvider>');
  return ctx;
}

/**
 * Holds Pip's shared state so any part of the page can make him react:
 * mood, speech bubble, hidden/visible, and BTC trend for his antenna candle.
 */
export function PipProvider({ children }) {
  const [mood, setMood] = useState('idle');
  const [bubble, setBubble] = useState({ text: '', show: false });
  const [hidden, setHiddenState] = useState(() => storage.get('pip-hidden') === '1');
  const [trend, setTrend] = useState(null); // { up: boolean, change: number } | null

  const baseMoodRef = useRef('idle'); // mood Pip returns to (idle, or worried on a red day)
  const moodRef = useRef(mood);
  const hiddenRef = useRef(hidden);
  const moodTimer = useRef(0);
  const bubbleTimer = useRef(0);
  const idleTimer = useRef(0);

  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { hiddenRef.current = hidden; }, [hidden]);

  /** Switch mood; with `ms`, fall back to the base mood afterwards. */
  const react = useCallback((next, ms) => {
    clearTimeout(moodTimer.current);
    setMood(next);
    if (ms) moodTimer.current = setTimeout(() => setMood(baseMoodRef.current), ms);
  }, []);

  const rest = useCallback(() => react(baseMoodRef.current), [react]);

  const say = useCallback((text, ms = 4500) => {
    if (hiddenRef.current || !text) return;
    clearTimeout(bubbleTimer.current);
    setBubble({ text, show: true });
    bubbleTimer.current = setTimeout(() => setBubble((b) => ({ ...b, show: false })), ms);
  }, []);

  const hush = useCallback(() => {
    clearTimeout(bubbleTimer.current);
    setBubble((b) => ({ ...b, show: false }));
  }, []);

  const setHidden = useCallback((value) => {
    setHiddenState(value);
    hiddenRef.current = value;
    storage.set('pip-hidden', value ? '1' : '0');
    if (value) hush();
  }, [hush]);

  // Any activity wakes Pip; 25s without activity puts him to sleep.
  const wake = useCallback(() => {
    if (moodRef.current === 'sleep') {
      react('happy', 1200);
      say('Oh! I was just checking the charts. Totally awake.', 3000);
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => { react('sleep'); hush(); }, SLEEP_AFTER_MS);
  }, [react, say, hush]);

  useEffect(() => {
    const events = ['pointermove', 'scroll', 'keydown', 'touchstart'];
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    wake();
    return () => {
      events.forEach((name) => window.removeEventListener(name, wake));
      clearTimeout(idleTimer.current);
      clearTimeout(moodTimer.current);
      clearTimeout(bubbleTimer.current);
    };
  }, [wake]);

  // BTC 24h change drives the candle colour and Pip's resting mood.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const change = Number((await fetchBinance(BTC_TICKER_PATH)).priceChangePercent);
        if (cancelled || !Number.isFinite(change)) return;
        setTrend({ up: change >= 0, change });
        baseMoodRef.current = change <= WORRIED_BELOW_PCT ? 'worried' : 'idle';
        setMood((m) => (m === 'idle' || m === 'worried' ? baseMoodRef.current : m));
      } catch {
        /* offline or blocked: Pip keeps his default green candle */
      }
    }
    check();
    const id = setInterval(check, MARKET_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const value = useMemo(
    () => ({ mood, bubble, hidden, trend, react, rest, say, hush, setHidden, wake }),
    [mood, bubble, hidden, trend, react, rest, say, hush, setHidden, wake]
  );

  return <PipContext.Provider value={value}>{children}</PipContext.Provider>;
}

/** Attach to a section: Pip says `line` the first time it scrolls into view. */
export function usePipLine(line) {
  const ref = useRef(null);
  const { react, say } = usePip();
  useEffect(() => {
    const el = ref.current;
    if (!el || !line || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      react('happy', 900);
      say(line);
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [line, react, say]);
  return ref;
}

export const OPEN_DOWNLOAD_EVENT = 'tradai:open-download';

/**
 * A download/upgrade link that makes Pip excited on hover or focus.
 * Download links open the platform picker instead of leaving the page;
 * the href stays as a no-JS fallback.
 */
export function CtaLink({ href = DOWNLOAD_URL, className = 'btn btn-primary', children }) {
  const { react, rest } = usePip();
  const opensPicker = href === DOWNLOAD_URL;
  return (
    <a
      className={className}
      href={href}
      onClick={opensPicker ? (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent(OPEN_DOWNLOAD_EVENT)); } : undefined}
      onPointerEnter={() => react('excited')}
      onPointerLeave={rest}
      onFocus={() => react('excited', 1500)}
      onBlur={rest}
    >
      {children}
    </a>
  );
}
