import { PipProvider, CtaLink, usePipLine } from './pip/PipContext.jsx';
import Pip from './pip/Pip.jsx';
import SignalDemo from './SignalDemo.jsx';
import DownloadModal from './DownloadModal.jsx';
import ProCheckout from './ProCheckout.jsx';
import { FEATURES, HERO, PIP_LINES, PLANS, STEPS } from './content.js';

export default function App() {
  return (
    <PipProvider>
      <Nav />
      <main id="top">
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
      <Pip />
      <DownloadModal />
      <ProCheckout />
    </PipProvider>
  );
}

/** A page block that makes Pip comment the first time it scrolls into view. */
function Block({ as: Tag = 'section', line, children, ...rest }) {
  const ref = usePipLine(line);
  return <Tag ref={ref} {...rest}>{children}</Tag>;
}

function Nav() {
  return (
    <header className="nav">
      <div className="wrap">
        <a href="#top" className="logo" aria-label="TradAI home">Trad<b>AI</b></a>
        <nav className="nav-links" aria-label="Main">
          <a href="#how" className="hide-sm">How it works</a>
          <a href="#pricing" className="hide-sm">Pricing</a>
          <CtaLink className="btn btn-primary btn-sm">Download</CtaLink>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <Block as="div" className="hero" line={PIP_LINES.hero}>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">{HERO.eyebrow}</span>
          <h1>Test any signal channel <em>before</em> you trust it with money.</h1>
          <p className="lead">{HERO.lead}</p>
          <div className="cta-row">
            <CtaLink>Download free</CtaLink>
            <a className="btn btn-ghost" href="#how">See how it works</a>
          </div>
          <p className="fine">{HERO.fine}</p>
        </div>

        <SignalDemo />
      </div>
    </Block>
  );
}

function HowItWorks() {
  return (
    <Block id="how" line={PIP_LINES.how}>
      <div className="wrap">
        <h2>How it works</h2>
        <p className="section-lead">No spreadsheets, no screenshots, no trusting a channel's own "win rate".</p>
        <div className="steps">
          {STEPS.map((step) => (
            <div className="step" key={step.title}><h3>{step.title}</h3><p>{step.text}</p></div>
          ))}
        </div>
      </div>
    </Block>
  );
}

function Features() {
  return (
    <Block id="features" line={PIP_LINES.features}>
      <div className="wrap">
        <h2>Built for people who follow signals</h2>
        <p className="section-lead">Everything a signal buyer actually needs, nothing else.</p>
        <div className="feats">
          {FEATURES.map((f) => (
            <div className="feat" key={f.title}><h3>{f.title}</h3><p>{f.text}</p></div>
          ))}
        </div>
      </div>
    </Block>
  );
}

function Pricing() {
  return (
    <Block id="pricing" line={PIP_LINES.pricing}>
      <div className="wrap">
        <h2>Simple pricing</h2>
        <p className="section-lead">Start free. Pay only when you want more channels and live trading.</p>
        <div className="plans">
          {PLANS.map((plan) => (
            <div className={`plan${plan.featured ? ' pro' : ''}`} key={plan.name}>
              <h3>{plan.name}</h3>
              <div className="price">{plan.price}{plan.period && <span>{plan.period}</span>}</div>
              <ul>{plan.items.map((item) => <li key={item}>{item}</li>)}</ul>
              <CtaLink href={plan.href} className={`btn ${plan.featured ? 'btn-primary' : 'btn-ghost'}`}>{plan.cta}</CtaLink>
            </div>
          ))}
        </div>
      </div>
    </Block>
  );
}

function FinalCta() {
  return (
    <Block className="final" line={PIP_LINES.final}>
      <div className="wrap">
        <h2>Stop guessing which channel works.</h2>
        <p className="lead">Let the results speak before your money does.</p>
        <div className="cta-row"><CtaLink>Download free</CtaLink></div>
      </div>
    </Block>
  );
}

function Footer() {
  return (
    <footer>
      <div className="wrap">
        <span>© {new Date().getFullYear()} TradAI</span>
        <span>Paper results don't guarantee live results. Crypto trading carries risk.</span>
      </div>
    </footer>
  );
}
