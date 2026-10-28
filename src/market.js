// Public Binance market data, called straight from the browser (no key needed).
// data-api.binance.vision is Binance's public market-data mirror; it also works
// where api.binance.com is region-blocked. Hosts are tried in order.
const BINANCE_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

export async function fetchBinance(path, timeoutMs = 8000) {
  let lastError = new Error('Market data unavailable');
  for (const host of BINANCE_HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${host}${path}`, { cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`Binance responded ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
