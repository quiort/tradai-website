import { useEffect, useRef, useState } from 'react';
import { usePip } from './PipContext.jsx';
import { PIP_TIPS } from '../content.js';

const PUPIL_REACH = 3.2; // max px the pupils move inside the eyes

/** Pip the pet: floating mascot, bottom-right. Needs <PipProvider> above it. */
export default function Pip() {
  const { mood, bubble, hidden, trend, react, say, setHidden, wake } = usePip();
  const buttonRef = useRef(null);
  const pupilsRef = useRef(null);
  const tipIndex = useRef(0);
  const clicks = useRef([]);
  const moodRef = useRef(mood);
  const [blink, setBlink] = useState(false);

  useEffect(() => { moodRef.current = mood; }, [mood]);

  // Eyes follow the pointer (skipped for reduced-motion users).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    function onMove(e) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const btn = buttonRef.current;
        const pupils = pupilsRef.current;
        if (!btn || !pupils) return;
        const box = btn.getBoundingClientRect();
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.53);
        const dist = Math.hypot(dx, dy) || 1;
        const reach = Math.min(PUPIL_REACH, dist / 40);
        pupils.style.transform = `translate(${(dx / dist) * reach}px, ${(dy / dist) * reach}px)`;
      });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(frame); };
  }, [hidden]);

  // Random blinking while his eyes are open.
  useEffect(() => {
    let timer;
    let closeTimer;
    function loop() {
      timer = setTimeout(() => {
        if (moodRef.current === 'idle' || moodRef.current === 'worried') {
          setBlink(true);
          closeTimer = setTimeout(() => setBlink(false), 140);
        }
        loop();
      }, 2200 + Math.random() * 3200);
    }
    loop();
    return () => { clearTimeout(timer); clearTimeout(closeTimer); };
  }, []);

  function handleClick() {
    wake();
    const now = Date.now();
    clicks.current = clicks.current.filter((t) => now - t < 700).concat(now);
    if (clicks.current.length >= 3) {
      clicks.current = [];
      react('spin', 700);
      say('Wheee! Okay, back to work.', 2500);
      return;
    }
    react('happy', 1100);
    say(PIP_TIPS[tipIndex.current]);
    tipIndex.current = (tipIndex.current + 1) % PIP_TIPS.length;
  }

  const label = trend
    ? `Pip, the TradAI mascot. BTC is ${trend.up ? 'up' : 'down'} ${Math.abs(trend.change).toFixed(1)}% today. Click for a tip.`
    : 'Pip, the TradAI mascot. Click for a tip.';

  if (hidden) {
    return (
      <div className="pip-dock">
        <button
          className="pip-recall"
          type="button"
          onClick={() => { setHidden(false); react('happy', 1100); setTimeout(() => say('Missed me?', 2500), 0); }}
        >
          Bring Pip back
        </button>
      </div>
    );
  }

  return (
    <div className="pip-dock">
      <div className={`pip-bubble${bubble.show ? ' show' : ''}`} role="status" aria-live="polite">
        {bubble.text}
      </div>
      <div className="pip-row">
        <button className="pip-close" type="button" aria-label="Hide Pip" onClick={() => setHidden(true)}>✕</button>
        <button
          ref={buttonRef}
          className={`pip${blink ? ' blink' : ''}`}
          type="button"
          aria-label={label}
          data-mood={mood}
          data-trend={trend && !trend.up ? 'down' : 'up'}
          onClick={handleClick}
        >
          <PipSvg pupilsRef={pupilsRef} />
        </button>
      </div>
    </div>
  );
}

function PipSvg({ pupilsRef }) {
  const ink = '#141020';
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="pip-g" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#b8a6ff" />
          <stop offset="1" stopColor="#7a5ef0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="26" ry="4" fill="#000" opacity=".35" />
      <g className="pip-body">
        {/* antenna with candle */}
        <path d="M60 36 Q58 26 62 18" stroke="#8a70f2" strokeWidth="3" fill="none" strokeLinecap="round" />
        <line x1="62" y1="3" x2="62" y2="21" stroke="#c9bdff" strokeWidth="1.5" strokeLinecap="round" />
        <rect className="pip-candle" x="57.5" y="7" width="9" height="11" rx="2" />
        {/* feet */}
        <ellipse cx="45" cy="101" rx="9" ry="5" fill="#6a4fe0" />
        <ellipse cx="75" cy="101" rx="9" ry="5" fill="#6a4fe0" />
        {/* body */}
        <path d="M60 32 C86 32 99 50 99 70 C99 90 83 102 60 102 C37 102 21 90 21 70 C21 50 34 32 60 32Z" fill="url(#pip-g)" />
        <ellipse cx="60" cy="82" rx="22" ry="14" fill="#fff" opacity=".12" />
        {/* cheeks */}
        <ellipse cx="36" cy="76" rx="6" ry="3.5" fill="#ff8fb3" opacity=".45" />
        <ellipse cx="84" cy="76" rx="6" ry="3.5" fill="#ff8fb3" opacity=".45" />
        {/* open eyes */}
        <g className="pip-eyes">
          <ellipse cx="47" cy="63" rx="8" ry="9" fill="#fff" />
          <ellipse cx="73" cy="63" rx="8" ry="9" fill="#fff" />
          <g className="pip-pupils" ref={pupilsRef}>
            <circle cx="47" cy="64" r="4.6" fill={ink} />
            <circle cx="73" cy="64" r="4.6" fill={ink} />
            <circle cx="48.6" cy="62" r="1.5" fill="#fff" />
            <circle cx="74.6" cy="62" r="1.5" fill="#fff" />
          </g>
          <g className="pip-lids">
            <ellipse cx="47" cy="63" rx="8.6" ry="9.6" fill="#8d72f4" />
            <ellipse cx="73" cy="63" rx="8.6" ry="9.6" fill="#8d72f4" />
          </g>
        </g>
        {/* happy ^^ eyes */}
        <g className="pip-happy-eyes" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M40 65 Q47 56 54 65" />
          <path d="M66 65 Q73 56 80 65" />
        </g>
        {/* sleeping eyes */}
        <g className="pip-sleep-eyes" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M40 63 Q47 69 54 63" />
          <path d="M66 63 Q73 69 80 63" />
        </g>
        {/* worried brows */}
        <g className="pip-worry-brows" stroke={ink} strokeWidth="2.5" strokeLinecap="round">
          <line x1="40" y1="50" x2="52" y2="53" />
          <line x1="80" y1="50" x2="68" y2="53" />
        </g>
        {/* mouths */}
        <path className="pip-mouth" d="M54 78 Q60 84 66 78" stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse className="pip-mouth-o" cx="60" cy="80" rx="4" ry="4.5" fill={ink} />
      </g>
      <g className="pip-zzz" fill="#c9bdff" fontFamily="Manrope,sans-serif" fontWeight="800">
        <text x="92" y="34" fontSize="12">z</text>
        <text x="100" y="24" fontSize="9">z</text>
      </g>
    </svg>
  );
}
