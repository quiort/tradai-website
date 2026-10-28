// All page copy lives here so text can change without touching components.

export const DOWNLOAD_URL = 'https://github.com/quiort/tradAII-release/releases/latest';

export const HERO = {
  eyebrow: 'For crypto signal buyers',
  lead: "TradAI reads Telegram signal channels, paper-trades every call automatically, and shows you the real P&L. Keep the channels that work. Drop the ones that don't.",
  fine: 'Windows app · Free plan · No card needed',
};

// Real signal from a public Telegram channel (one of the app's default feeds),
// shown with the app's own signal-card layout. Levels are copied exactly from the
// post; `reportedHits` comes from the channel's own follow-up posts (TP1–TP3 hit).
// To swap in a newer signal, change only this object.
export const SIGNAL_DEMO = {
  signalId: 'G180',
  symbol: 'XRPUSDT',
  side: 'LONG',
  dateLabel: 'OCT 2026',
  entryZone: [1.29, 1.3],
  stop: 1.15,
  targets: [1.365, 1.45, 1.55, 1.7, 1.9, 2.2, 2.5],
  leverage: { min: 3, max: 5 },
  reportedHits: 3,
  size: 200, // app default: 2% of $10,000 capital
};

export const STEPS = [
  { title: 'Add a channel', text: "Paste any public Telegram signal channel. TradAI reads new calls as they're posted." },
  { title: 'It copies every call', text: 'Entries, stops and targets go into Paper mode automatically. No real money involved.' },
  { title: 'See the real results', text: 'Track P&L per position and over time, then decide which channel deserves your money.' },
];

export const FEATURES = [
  { title: 'Auto paper-copy', text: 'Fresh signals are copied within 15 minutes of posting. Old ones are skipped so results stay honest.' },
  { title: 'Target alerts & partial sells', text: 'Get notified when a TP is hit and sell 20%, 50%, 75% or 100% in one click.' },
  { title: "Go live when you're ready", text: 'Optional Binance Spot mode places real orders with a stop-loss attached. Off by default.' },
  { title: 'Your data stays on your PC', text: 'Settings, encrypted API keys and trade history are stored locally, not uploaded.' },
];

// TODO: confirm the exact Free plan limits with the app before launch.
// TODO: point Pro's link at the payment page once it exists.
export const PLANS = [
  {
    name: 'FREE',
    price: '$0',
    items: ['1 signal channel', 'Paper mode auto-copy', 'Target alerts'],
    cta: 'Download free',
    href: DOWNLOAD_URL,
  },
  {
    name: 'PRO',
    price: '$20',
    period: ' / month',
    featured: true,
    items: ['Unlimited signal channels', 'Binance Live mode', 'Full P&L history', 'TradAI signal channel included'],
    cta: 'Get Pro',
    href: DOWNLOAD_URL,
  },
];

// What Pip says when each section scrolls into view (once per visit).
export const PIP_LINES = {
  hero: "Hi, I'm Pip! I watch signal channels so you don't have to guess.",
  how: 'Three steps. The boring part is my job.',
  features: 'Psst, you get an alert the moment a target is hit.',
  pricing: 'Start free. Upgrade when a channel proves itself.',
  final: "Ready when you are. I'll keep the channels honest.",
};

// What Pip says when clicked (rotates).
export const PIP_TIPS = [
  "A channel's own win rate is marketing. Your paper P&L is the truth.",
  'Give a channel at least 20 calls before you judge it.',
  'Never risk more on one signal than you can lose calmly.',
  'Late entries ruin good signals. I skip calls older than 15 minutes.',
  'Taking partial profit at TP1 makes bad days much smaller.',
  'Paper first. Live later. Always in that order.',
];
