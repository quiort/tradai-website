import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchBinance } from './market.js';
import { usePip } from './pip/PipContext.jsx';
import { SIGNAL_DEMO } from './content.js';

const LIVE_REFRESH_MS = 5000;   // same cadence as the app's position refresh
const REPLAY_TICK_MS = 900;
const SPARK_POINTS = 48;

// ---- Formatting copied from the app (renderer.js) so numbers read identically ----
const money = (value, digits = 2) => (Number.isFinite(Number(value))
  ? Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  : '—');
const priceText = (value) => (Number.isFinite(Number(value)) ? `$${money(value, Number(value) < 1 ? 4 : 2)}` : '—');
const signalPriceText = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const digits = n >= 1000 ? 2 : n >= 0.1 ? 3 : n >= 0.01 ? 4 : 8;
  return `$${money(n, digits)}`;
};
const formatPnl = (value) => `${value >= 0 ? '+' : '−'}$${money(Math.abs(value), 2)}`;

/**
 * Replay path used when live prices can't load: walks from the lowest entry up
 * through each reported take-profit hit, pauses at the last one, then loops.
 * Only the reported levels are real; the wiggle between them is illustrative,
 * and the card labels this mode "REPLAY".
 */
function buildReplayPath(entry, targets, hits) {
  const stops = [entry, ...targets.slice(0, hits)];
  const path = [];
  for (let leg = 0; leg < stops.length - 1; leg += 1) {
    const from = stops[leg];
    const to = stops[leg + 1];
    const steps = 14;
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      const ease = t * t * (3 - 2 * t);
      const wiggle = Math.sin((leg * steps + i) * 1.3) * (to - from) * 0.09 * (1 - t);
      path.push(from + (to - from) * ease + wiggle);
    }
    // small pullback after each hit, like real price action
    path.push(to * 1.002, to * 0.996, to * 0.993);
  }
  const last = stops[stops.length - 1];
  for (let i = 0; i < 10; i += 1) path.push(last * (1.002 + Math.sin(i * 0.9) * 0.004));
  return path;
}

function Sparkline({ points, up }) {
  if (points.length < 2) return <div className="demo-spark" aria-hidden="true" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * 100).toFixed(2)},${(44 - ((p - min) / span) * 40).toFixed(2)}`)
    .join(' ');
  const color = up ? 'var(--green)' : 'var(--red)';
  return (
    <div className="demo-spark" aria-hidden="true">
      <svg viewBox="0 0 100 48" preserveAspectRatio="none">
        <path d={`${line} L100,48 L0,48Z`} fill={color} opacity=".09" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function SignalDemo() {
  const s = SIGNAL_DEMO;
  const { react, say } = usePip();
  const entry = Math.min(...s.entryZone);            // app basis: lowest price in the entry zone
  const finalTarget = s.targets[s.targets.length - 1];
  const quantity = s.size / entry;

  const replayPath = useMemo(() => buildReplayPath(entry, s.targets, s.reportedHits), [entry, s.targets, s.reportedHits]);
  // Open the replay just after TP1 so the first frame already shows the trade working.
  const replayStart = useMemo(() => {
    const i = replayPath.findIndex((p) => p >= s.targets[0]);
    return i < 0 ? 0 : Math.min(replayPath.length - 1, i + 3);
  }, [replayPath, s.targets]);
  const startPrice = replayPath[replayStart];
  const [mode, setMode] = useState('replay');        // 'live' once Binance answers with a usable price
  const [mark, setMark] = useState(startPrice);
  const [history, setHistory] = useState(() => replayPath.slice(0, replayStart + 1).slice(-SPARK_POINTS));
  const [flash, setFlash] = useState('');
  const [maxSeen, setMaxSeen] = useState(() => Math.max(...replayPath.slice(0, replayStart + 1)));
  const replayIndex = useRef(replayStart);
  const prevMark = useRef(startPrice);
  const announced = useRef(new Set());
  const cardRef = useRef(null);
  const visible = useRef(true);

  // Only let Pip comment while the card is on screen.
  useEffect(() => {
    if (!cardRef.current || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.3 });
    io.observe(cardRef.current);
    return () => io.disconnect();
  }, []);

  // Live mode: real XRP price every 5 s. Falls back to replay if it can't load
  // or if price is outside the stop–final-target range (position would be closed).
  useEffect(() => {
    let cancelled = false;
    let timer;
    async function loadHistory() {
      try {
        const rows = await fetchBinance(`/api/v3/klines?symbol=${s.symbol}&interval=15m&limit=${SPARK_POINTS}`);
        if (!cancelled && Array.isArray(rows) && rows.length) setHistory(rows.map((r) => Number(r[4])).filter(Number.isFinite));
      } catch { /* sparkline fills from live ticks instead */ }
    }
    async function tick(first) {
      try {
        const data = await fetchBinance(`/api/v3/ticker/price?symbol=${s.symbol}`);
        const price = Number(data.price);
        if (cancelled) return;
        if (!Number.isFinite(price) || price <= s.stop || price >= finalTarget) throw new Error('out of range');
        if (first) { setMode('live'); loadHistory(); }
        setMark(price);
        setHistory((h) => [...h, price].slice(-SPARK_POINTS));
        timer = setTimeout(() => tick(false), LIVE_REFRESH_MS);
      } catch {
        if (!cancelled) setMode('replay');
      }
    }
    tick(true);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [s.symbol, s.stop, finalTarget]);

  // Replay mode: step along the replay path.
  useEffect(() => {
    if (mode !== 'replay') return undefined;
    const id = setInterval(() => {
      replayIndex.current = (replayIndex.current + 1) % replayPath.length;
      if (replayIndex.current === 0) { announced.current.clear(); setMaxSeen(entry); setHistory([entry]); }
      const price = replayPath[replayIndex.current];
      setMark(price);
      setHistory((h) => [...h, price].slice(-SPARK_POINTS));
    }, REPLAY_TICK_MS);
    return () => clearInterval(id);
  }, [mode, replayPath, entry]);

  // Price flash + highest price seen (for TP hit state).
  useEffect(() => {
    if (mark !== prevMark.current) {
      setFlash(mark > prevMark.current ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlash(''), 650);
      prevMark.current = mark;
      setMaxSeen((m) => Math.max(m, mark));
      return () => clearTimeout(t);
    }
    return undefined;
  }, [mark]);

  // Reported hits always count; live price can add more.
  const hitCount = s.targets.filter((t, i) => i < s.reportedHits || maxSeen >= t).length;
  const replayHits = s.targets.filter((t) => maxSeen >= t).length;
  const shownHits = mode === 'replay' ? replayHits : hitCount;

  // Pip cheers each new TP hit (once per loop, only when the card is visible).
  useEffect(() => {
    if (shownHits < 1 || announced.current.has(shownHits)) return;
    announced.current.add(shownHits);
    if (!visible.current) return;
    react('excited', 1400);
    say(`TP${shownHits} hit on XRP! ${shownHits === 1 ? 'Paper profit is rolling.' : 'Still climbing.'}`, 3000);
  }, [shownHits, react, say]);

  const pnl = quantity * (mark - entry);
  const pct = (pnl / s.size) * 100;
  const up = pnl >= 0;
  const risk = entry - s.stop;
  const reward = finalTarget - entry;
  const riskReward = risk > 0 && reward > 0 ? reward / risk : null;
  const base = s.symbol.replace(/USDT$|USDC$/, '');
  const quote = s.symbol.slice(-4);

  return (
    <div className="app-frame" ref={cardRef} aria-label={`Real ${base} signal shown the way the TradAI app shows it`}>
      <div className="app-bar" aria-hidden="true">
        <span className="app-dots"><i /><i /><i /></span>
        <span>TradAI Dashboard</span>
      </div>

      <div className="panel signal-panel">
        <div className="panel-heading">
          <div><h2>Latest signals</h2><p>Recent trade setups</p></div>
          <span className="live-indicator"><i className={mode === 'live' ? '' : 'replay'} />{mode === 'live' ? 'LIVE PRICE' : 'REPLAY'}</span>
        </div>

        <article className="signal-item compact-signal">
          <div className="signal-row-top">
            <div className="signal-market">
              <span className="signal-coin">⌁</span>
              <div>
                <span className="signal-chart-trigger">{base}/{quote}<span aria-hidden="true">↗</span></span>
                <small>TRADE SIGNAL · OPEN CHART · {s.dateLabel}</small>
              </div>
            </div>
            <span className="long-badge"><i /> {s.side}</span>
          </div>

          <div className="signal-tags">
            <span className="signal-tag">SIGNAL #{s.signalId}</span>
            <span className="signal-tag">SIGNAL LEVERAGE · {s.leverage.min}–{s.leverage.max}×</span>
          </div>

          <div className="signal-levels">
            <div><small>ENTRY ZONE</small><b>{signalPriceText(s.entryZone[0])} – {signalPriceText(s.entryZone[1])}</b></div>
            <div><small>STOP LOSS</small><b className="level-stop">{signalPriceText(s.stop)}</b></div>
            <div><small>RISK / REWARD</small><b>{riskReward ? `${money(riskReward, 1)}×` : '—'}</b></div>
          </div>

          <div className="signal-targets">
            <div className="signal-targets-head"><small>TAKE PROFIT</small><span>{s.targets.length} levels · {shownHits} hit</span></div>
            <div className="tp-chip-row">
              {s.targets.map((t, i) => {
                const hit = i < shownHits;
                return (
                  <span key={t} className={`signal-target-chip${hit ? ' ready' : ''}`}>
                    <small>TP{i + 1}</small>
                    <b className={hit ? 'level-target' : ''}>{signalPriceText(t)}</b>
                    {hit && <em aria-label="hit">✓</em>}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="signal-actions">
            <span className="paper-button is-done">Position opened</span>
            <span className="live-action">Live order</span>
          </div>
        </article>

        <div className="position-strip">
          <div className="pos-head">
            <span className="type-pill">PAPER</span>
            <span className="status-tag open">OPEN</span>
            <Sparkline points={history} up={up} />
          </div>
          <div className="pos-grid">
            <div><span>ENTRY</span><b>{priceText(entry)}</b><small>lowest signal entry</small></div>
            <div><span>MARK</span><b className={`mark ${flash}`}>${money(mark, 4)}</b><small>{mode === 'live' ? 'Market price · now' : 'Reported levels'}</small></div>
            <div><span>SIZE</span><b>${money(s.size)}</b><small>2% of $10,000</small></div>
            <div>
              <span>P&amp;L</span>
              <b className={up ? 'positive' : 'negative'}>{formatPnl(pnl)}</b>
              <small className={up ? 'positive' : 'negative'}>{pct >= 0 ? '+' : ''}{money(pct)}% of size</small>
            </div>
          </div>
        </div>
      </div>

      <p className="demo-note">
        Real signal #{s.signalId} from a public Telegram channel. The channel reported TP1–TP{s.reportedHits} hit.
        {mode === 'live' ? ' Price is live from Binance.' : ' Replay steps through the reported levels.'} Not every signal wins, which is why TradAI tracks them all.
      </p>
    </div>
  );
}
