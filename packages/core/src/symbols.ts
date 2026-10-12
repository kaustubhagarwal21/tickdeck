/**
 * The instruments each feed streams.
 *
 * The lists are plain `string[]` (not readonly) so they can be passed straight
 * to `MarketFeed.connect()` and to the market store's `reset()`.
 */

/** NSE stocks used by the simulated feed. Their prices are generated in the browser, not live. */
export const SIM_SYMBOLS: string[] = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN'];

/**
 * Starting price in INR for each simulated stock. These are rough real-world
 * levels so the simulation looks plausible; they are not quotes.
 */
export const SIM_SEED_PRICES: Record<string, number> = {
  RELIANCE: 1450,
  TCS: 3100,
  INFY: 1520,
  HDFCBANK: 985,
  ICICIBANK: 1410,
  SBIN: 820,
};

/** Crypto pairs streamed live from Binance's public market-data WebSocket. Prices are in USDT. */
export const BINANCE_SYMBOLS: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
