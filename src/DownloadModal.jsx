import { useCallback, useEffect, useRef, useState } from 'react';
import { OPEN_DOWNLOAD_EVENT, usePip } from './pip/PipContext.jsx';
import { DOWNLOAD } from './content.js';

// Asks GitHub for the newest release so the button always serves the latest
// installer without editing the site. Falls back to the pinned URL if GitHub
// is slow or rate-limited (60 unauthenticated calls per hour per visitor IP).
async function latestWindowsInstaller() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(DOWNLOAD.releaseApi, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const release = await res.json();
    const exe = (release.assets || []).find((a) => /\.exe$/i.test(a.name) && !/blockmap/i.test(a.name));
    if (!exe?.browser_download_url) throw new Error('No installer in release');
    return { url: exe.browser_download_url, version: release.tag_name, sizeMb: Math.round(exe.size / 1e6) };
  } finally {
    clearTimeout(timer);
  }
}

function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|mac/i.test(ua)) return 'mac';
  if (/linux|x11/i.test(ua)) return 'linux';
  return 'windows';
}

const ICONS = {
  windows: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5 10 4.5v7H3zM11 4.3 21 3v8.5H11zM3 12.5h7v7l-7-1zM11 12.5h10V21l-10-1.4z" /></svg>,
  mac: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.5 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.8c-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.3zM14 5.1c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" /></svg>,
  linux: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v12h14V6zm2.3 2.3 3.2 3.2-3.2 3.2-1.1-1.1 2.1-2.1-2.1-2.1zM11 15h6v1.6h-6z" /></svg>,
  android: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9h10v8a1 1 0 0 1-1 1h-1v3h-2v-3h-2v3H9v-3H8a1 1 0 0 1-1-1zm-2.5 0A1.5 1.5 0 0 1 6 10.5v4a1.5 1.5 0 0 1-3 0v-4A1.5 1.5 0 0 1 4.5 9zm15 0a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-3 0v-4A1.5 1.5 0 0 1 19.5 9zM15.5 3.6l1-1.6-.5-.3-1 1.6A6 6 0 0 0 12 2.6a6 6 0 0 0-3 .7l-1-1.6-.5.3 1 1.6A5 5 0 0 0 7 8h10a5 5 0 0 0-1.5-4.4zM10 6a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2zm4 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2z" /></svg>,
};

const PLATFORMS = [
  { id: 'windows', name: 'Windows', note: 'Windows 10 and 11 · 64-bit', available: true },
  { id: 'mac', name: 'macOS', note: 'Apple silicon and Intel' },
  { id: 'linux', name: 'Linux', note: 'AppImage and .deb' },
  { id: 'android', name: 'Android', note: 'Phone app' },
];

export default function DownloadModal() {
  const { react, say } = usePip();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | starting | started
  const [file, setFile] = useState({ url: DOWNLOAD.fallbackUrl, version: DOWNLOAD.fallbackVersion, sizeMb: DOWNLOAD.fallbackSizeMb });
  const [platform, setPlatform] = useState('windows');
  const dialogRef = useRef(null);
  const openerRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setStatus('idle');
    openerRef.current?.focus?.();
  }, []);

  // Open from any Download button on the page.
  useEffect(() => {
    function onOpen() {
      openerRef.current = document.activeElement;
      setPlatform(detectPlatform());
      setStatus('idle');
      setOpen(true);
      latestWindowsInstaller().then(setFile).catch(() => { /* keep the pinned fallback */ });
    }
    window.addEventListener(OPEN_DOWNLOAD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DOWNLOAD_EVENT, onOpen);
  }, []);

  // Escape closes; focus moves into the dialog.
  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.querySelector('[data-autofocus]')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, close]);

  function startWindowsDownload() {
    setStatus('starting');
    react('excited', 1800);
    say('Good choice! Your download is starting.', 3500);
    // GitHub serves release assets as attachments, so navigating to the URL
    // starts the download and the page stays where it is.
    window.location.href = file.url;
    setTimeout(() => setStatus('started'), 900);
  }

  if (!open) return null;

  const sizeText = file.sizeMb ? ` · ${file.sizeMb} MB` : '';
  const onOtherOs = platform !== 'windows';

  return (
    <div className="dl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dl-dialog" role="dialog" aria-modal="true" aria-labelledby="dl-title" ref={dialogRef}>
        <button type="button" className="dl-close" aria-label="Close" onClick={close}>✕</button>
        <h2 id="dl-title">Download TradAI</h2>
        <p className="dl-lead">Free plan included. No card needed.</p>

        <ul className="dl-list">
          {PLATFORMS.map((p) => (
            <li key={p.id} className={`dl-item${p.available ? ' is-available' : ''}${platform === p.id ? ' is-yours' : ''}`}>
              <span className="dl-icon">{ICONS[p.id]}</span>
              <span className="dl-text">
                <strong>{p.name}{platform === p.id && <em> · your device</em>}</strong>
                <small>{p.available ? `${p.note} · ${file.version}${sizeText}` : p.note}</small>
              </span>
              {p.available ? (
                <button type="button" className="btn btn-primary btn-sm" data-autofocus onClick={startWindowsDownload} disabled={status === 'starting'}>
                  {status === 'idle' ? 'Download' : status === 'starting' ? 'Starting…' : 'Download again'}
                </button>
              ) : (
                <span className="dl-soon">Soon</span>
              )}
            </li>
          ))}
        </ul>

        {status === 'started' && (
          <p className="dl-status" role="status">
            Your download has started. Not seeing it? <a href={file.url}>Click here</a>. Then open <b>TradAI-Setup</b> from your Downloads folder.
          </p>
        )}
        {onOtherOs && status === 'idle' && (
          <p className="dl-status muted">TradAI runs on Windows for now. Versions for your device are on the way.</p>
        )}
      </div>
    </div>
  );
}
