# TradAI website (React + Vite)

Minimalist landing page for TradAI with **Pip the pet** in the bottom-right corner.

## Run it on your PC

Needs Node.js 18+.

```bash
cd tradai-site
npm install
npm run dev        # opens on http://localhost:5173
```

Build for hosting:

```bash
npm run build      # output goes to dist/ — upload that folder anywhere static
npm run preview    # check the production build locally
```

## Where things live

| File | What it does |
|---|---|
| `src/content.js` | All page text, plans, Pip's lines and tips. Edit copy here only. |
| `src/App.jsx` | Page sections (nav, hero, how it works, features, pricing, footer). |
| `src/pip/PipContext.jsx` | Pip's brain: mood, speech bubble, sleep timer, BTC trend, hide/show. Also `usePipLine()` (section comments) and `<CtaLink>` (makes Pip excited). |
| `src/pip/Pip.jsx` | Pip's body: SVG, eye tracking, blinking, click tips, triple-click spin. |
| `src/pip/pip.css` | Pip's animations and mood styles. |
| `src/styles.css` | Site styles, same colors and fonts as the desktop app. |

## Pip behaviour

- Eyes follow the cursor, random blinking
- Says one line per section the first time it scrolls into view
- Click → rotating tip · 3 quick clicks → spin
- Excited when hovering a Download / Pro button
- Sleeps after 25 s with no activity, wakes on any movement
- Antenna candle is green/red with BTC's 24 h change (Binance public API); worried when BTC is down 3 %+
- Can be hidden and brought back (remembered per browser)
- Respects reduced-motion; keyboard and screen-reader friendly

## To confirm before launch

- Free plan limits in `src/content.js` (`PLANS`) must match the app.
- "Get Pro" link needs the real payment page.
