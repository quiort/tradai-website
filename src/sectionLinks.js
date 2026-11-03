// Clean section URLs: /how, /features, /pricing instead of #how etc.
// GitHub Pages serves a copy of index.html at each path (see the build script).
export const SECTIONS = ['how', 'features', 'pricing'];

function scrollToSection(id, smooth) {
  const el = id ? document.getElementById(id) : null;
  if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' });
  else window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' });
}

/** onClick handler for <a href="/how">: scroll in place and update the URL. */
export function goToSection(event, id) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
  event.preventDefault();
  const path = id ? `/${id}` : '/';
  if (location.pathname !== path) history.pushState(null, '', path);
  scrollToSection(id, true);
}

/** On load: honor /how, or an old #how link (rewritten to /how). */
export function initSectionRouting() {
  const fromHash = location.hash.slice(1);
  if (SECTIONS.includes(fromHash)) history.replaceState(null, '', `/${fromHash}`);
  const id = location.pathname.replace(/^\/|\/$/g, '');
  if (SECTIONS.includes(id)) {
    try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }
    // Jump once the page has rendered, then again after fonts/images settle the layout.
    [60, 400, 1200].forEach((ms) => setTimeout(() => scrollToSection(id, false), ms));
  }
  window.addEventListener('popstate', () => {
    const current = location.pathname.replace(/^\/|\/$/g, '');
    scrollToSection(SECTIONS.includes(current) ? current : '', true);
  });
}
