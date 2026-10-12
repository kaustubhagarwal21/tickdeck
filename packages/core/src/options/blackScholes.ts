/**
 * Black-Scholes prices and Greeks for European options on an underlying that
 * pays no dividends.
 *
 * Inputs use textbook units: time in years, and the rate and volatility as
 * yearly decimals (0.05 = 5%, 0.2 = 20%). The Greeks come back in the units an
 * option chain shows: theta per calendar day and vega per 1 point of volatility.
 */

export interface BlackScholesInput {
  /** Price of the underlying now. */
  spot: number;
  strike: number;
  /** Time to expiry in years. */
  years: number;
  /** Risk-free rate a year, continuously compounded: 0.05 means 5%. */
  rate: number;
  /** Volatility a year: 0.2 means 20%. */
  vol: number;
}

/** The fair value of one option and its sensitivities. */
export interface OptionGreeks {
  price: number;
  /** Price change for a 1-unit rise in the underlying: 0 to 1 for a call, -1 to 0 for a put. */
  delta: number;
  /** Delta change for a 1-unit rise in the underlying. The same for a call and a put. */
  gamma: number;
  /** Price change as one calendar day passes. Usually negative: time decay. */
  theta: number;
  /** Price change for a 1-point rise in volatility (20% to 21%). */
  vega: number;
}

/** Theta is quoted per calendar day, so the yearly figure is divided by 365. */
const DAYS_PER_YEAR = 365;

/** Standard normal density: the height of the bell curve at x. */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution N(x): the chance that a standard
 * normal variable is below x. Uses the polynomial approximation 26.2.17 from
 * Abramowitz and Stegun, accurate to 7.5e-8, far finer than a paisa of price.
 */
export function normCdf(x: number): number {
  // The curve is symmetric, so N(-x) = 1 - N(x). This also makes
  // N(x) + N(-x) exactly 1, which keeps put-call parity exact.
  if (x < 0) return 1 - normCdf(-x);
  const t = 1 / (1 + 0.2316419 * x);
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - normPdf(x) * poly;
}

/** Prices a call and a put with the same strike and expiry; they share d1, d2 and most terms. */
export function blackScholes({ spot, strike, years, rate, vol }: BlackScholesInput): {
  call: OptionGreeks;
  put: OptionGreeks;
} {
  // e^(-rT): what 1 paid at expiry is worth today.
  const discount = Math.exp(-rate * Math.max(years, 0));

  // At expiry, or with no volatility, nothing is uncertain: each option is
  // worth its intrinsic value against the discounted strike, and delta is
  // 0 or 1 (-1 for a put). The other Greeks are zero.
  if (years <= 0 || vol <= 0) {
    const forwardGain = spot - strike * discount;
    return {
      call: { price: Math.max(forwardGain, 0), delta: forwardGain > 0 ? 1 : 0, gamma: 0, theta: 0, vega: 0 },
      put: { price: Math.max(-forwardGain, 0), delta: forwardGain < 0 ? -1 : 0, gamma: 0, theta: 0, vega: 0 },
    };
  }

  const sqrtT = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * years) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const pdf = normPdf(d1);

  // Shared by the call and the put.
  const gamma = pdf / (spot * vol * sqrtT);
  const vega = (spot * pdf * sqrtT) / 100; // per 1 point of volatility, not per 100
  const timeDecay = -(spot * pdf * vol) / (2 * sqrtT); // the volatility part of theta, a year
  const pvStrike = strike * discount; // present value of the strike

  return {
    call: {
      price: spot * normCdf(d1) - pvStrike * normCdf(d2),
      delta: normCdf(d1),
      gamma,
      // As expiry nears, the strike the call holder pays is discounted less, which costs value too.
      theta: (timeDecay - rate * pvStrike * normCdf(d2)) / DAYS_PER_YEAR,
      vega,
    },
    put: {
      price: pvStrike * normCdf(-d2) - spot * normCdf(-d1),
      delta: normCdf(d1) - 1,
      gamma,
      // The put holder receives the strike, so the same effect adds value: a deep
      // in-the-money put can gain value as time passes (positive theta).
      theta: (timeDecay + rate * pvStrike * normCdf(-d2)) / DAYS_PER_YEAR,
      vega,
    },
  };
}
