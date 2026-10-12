import { blackScholes, type OptionGreeks } from './blackScholes';

/**
 * A simulated option chain: Black-Scholes values for a ladder of strikes
 * around the spot price, with an assumed volatility smile. No exchange quotes
 * are involved; every number is a model output.
 */

/** One side (call or put) of one strike. */
export interface OptionQuote extends OptionGreeks {
  /** Implied volatility used for this strike, as a decimal: 0.2 means 20%. */
  iv: number;
  /** In the money: a call with its strike below spot, a put with its strike above. */
  itm: boolean;
}

export interface ChainRow {
  strike: number;
  call: OptionQuote;
  put: OptionQuote;
  /** At the money: the strike nearest the spot price. One row per chain. */
  isAtm: boolean;
}

export interface ChainParams {
  spot: number;
  /** Gap between neighbouring strikes, e.g. from strikeStepFor(spot). */
  strikeStep: number;
  /** Strikes listed below and above the ATM strike. */
  strikesEachSide: number;
  /** Expiry and now, in epoch milliseconds. */
  expiryMs: number;
  nowMs: number;
  /** Risk-free rate a year: 0.06 means 6%. */
  rate: number;
  /** Implied volatility at the money: 0.2 means 20%. */
  ivAtm: number;
  /** How fast IV rises away from the money. See smileIv(). */
  smile: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

/**
 * Implied volatility at a strike: the ATM IV plus `smile` times the squared
 * log-moneyness. It is lowest at spot and rises on both sides, like the smile
 * seen on real chains. With smile = 3, a strike 10% away gets about 2.7 more
 * points of IV (ln(1.1)^2 x 3 = 0.027).
 */
export function smileIv(ivAtm: number, smile: number, spot: number, strike: number): number {
  const moneyness = Math.log(strike / spot); // 0 at spot, about +-0.1 for strikes 10% away
  return ivAtm + smile * moneyness * moneyness;
}

/** k x step without binary floating-point noise: 213 x 0.001 is 0.213, not 0.21300000000000002. */
function strikeAt(k: number, step: number): number {
  return Number((k * step).toPrecision(12));
}

/** The chain's rows, lowest strike first. Empty when the spot price or the step is not positive. */
export function buildChain(params: ChainParams): ChainRow[] {
  const { spot, strikeStep, strikesEachSide, expiryMs, nowMs, rate, ivAtm, smile } = params;
  if (!(spot > 0) || !(strikeStep > 0)) return [];

  const years = (expiryMs - nowMs) / YEAR_MS; // 0 or less means expired: blackScholes returns intrinsic values
  const atmIndex = Math.round(spot / strikeStep); // the ATM strike is atmIndex x strikeStep

  const rows: ChainRow[] = [];
  for (let i = -strikesEachSide; i <= strikesEachSide; i++) {
    const strike = strikeAt(atmIndex + i, strikeStep);
    if (strike <= 0) continue; // a cheap underlying cannot list strikes at or below zero

    const iv = smileIv(ivAtm, smile, spot, strike);
    const { call, put } = blackScholes({ spot, strike, years, rate, vol: iv });
    rows.push({
      strike,
      call: { ...call, iv, itm: strike < spot },
      put: { ...put, iv, itm: strike > spot },
      isAtm: i === 0,
    });
  }
  return rows;
}

/**
 * Strike spacing for an underlying at `price`: about 1% of the price, rounded
 * down to 1, 2.5 or 5 times a power of ten. TCS at 3,100 gets 25, SBIN at 820
 * gets 5, BTC at 100,000 gets 1,000 and DOGE at 0.2 gets 0.001. Dearer
 * underlyings get wider steps, as on an exchange. The step is always between
 * 0.4% and 1% of the price, so 10 strikes each side cover 4% to 10% either way.
 */
export function strikeStepFor(price: number): number {
  if (!(price > 0)) return 1;
  const target = price / 100;
  const power = 10 ** Math.floor(Math.log10(target)); // 10 for 31, 0.001 for 0.002
  if (5 * power <= target) return 5 * power;
  if (2.5 * power <= target) return 2.5 * power;
  return power;
}

// ---- Expiries -------------------------------------------------------------
//
// NSE equity derivatives expire on a Tuesday (NSE's expiry day since
// September 2025) at the 15:30 IST close. Weekly contracts expire every
// Tuesday, monthly ones on the last Tuesday of the month. Exchange holidays,
// which move an expiry to the day before, are ignored here.
//
// India Standard Time is UTC+5:30 all year (no daylight saving), so the maths
// is done in UTC and never depends on the computer's own time zone.

export type ExpiryKind = 'weekly' | 'monthly';

const IST_OFFSET_MS = 330 * 60 * 1000; // 5 h 30 min
const TUESDAY = 2; // as in Date.getUTCDay(): Sunday = 0
const CLOSE_HOUR_UTC = 10; // 15:30 IST is 10:00 UTC

/** 15:30 IST on an IST calendar date, in epoch ms. Date.UTC rolls day 32 into the next month. */
function closeOn(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day, CLOSE_HOUR_UTC);
}

/** The IST calendar date of a moment: shift it by +5:30, then read the UTC fields. */
function istDate(ms: number) {
  const d = new Date(ms + IST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
}

/** The next weekly expiry after nowMs: this Tuesday at 15:30 IST, or next Tuesday once that has passed. */
export function nextWeeklyExpiry(nowMs: number): number {
  const { year, month, day, weekday } = istDate(nowMs);
  const daysAhead = (TUESDAY - weekday + 7) % 7; // 0 on a Tuesday
  const expiry = closeOn(year, month, day + daysAhead);
  return expiry > nowMs ? expiry : expiry + 7 * DAY_MS;
}

/** 15:30 IST on the last Tuesday of a month (0-11; 12 means January of the next year). */
function lastTuesdayClose(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)); // day 0 of next month = last day of this one
  const daysBack = (lastDay.getUTCDay() - TUESDAY + 7) % 7;
  return closeOn(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate() - daysBack);
}

/** The next monthly expiry after nowMs: this month's last Tuesday, or next month's once that has passed. */
export function nextMonthlyExpiry(nowMs: number): number {
  const { year, month } = istDate(nowMs);
  const thisMonth = lastTuesdayClose(year, month);
  return thisMonth > nowMs ? thisMonth : lastTuesdayClose(year, month + 1);
}

export function nextExpiry(kind: ExpiryKind, nowMs: number): number {
  return kind === 'weekly' ? nextWeeklyExpiry(nowMs) : nextMonthlyExpiry(nowMs);
}
