import { blackScholes, normCdf, normPdf } from '../blackScholes';

// The textbook example (Hull): spot 100, strike 100, one year, 5% rate, 20% volatility.
const TEXTBOOK = { spot: 100, strike: 100, years: 1, rate: 0.05, vol: 0.2 };

describe('normCdf', () => {
  it('matches known values of the standard normal distribution', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 7);
    expect(normCdf(1)).toBeCloseTo(0.841345, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975002, 6);
    expect(normCdf(-1.96)).toBeCloseTo(0.024998, 6);
  });

  it('is symmetric: N(x) + N(-x) = 1', () => {
    for (const x of [0.1, 0.35, 1.5, 3]) {
      expect(normCdf(x) + normCdf(-x)).toBe(1);
    }
  });

  it('has the bell-curve density at 0', () => {
    expect(normPdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 12);
  });
});

describe('blackScholes', () => {
  it('prices the textbook call and put', () => {
    const { call, put } = blackScholes(TEXTBOOK);
    expect(call.price).toBeCloseTo(10.4506, 4);
    expect(put.price).toBeCloseTo(5.5735, 4);
  });

  it('gives the textbook Greeks', () => {
    const { call, put } = blackScholes(TEXTBOOK);
    // d1 = 0.35, so call delta = N(0.35) and put delta = N(0.35) - 1.
    expect(call.delta).toBeCloseTo(0.6368, 4);
    expect(put.delta).toBeCloseTo(-0.3632, 4);
    // Gamma and vega are the same for a call and a put.
    expect(call.gamma).toBeCloseTo(0.018762, 6);
    expect(put.gamma).toBe(call.gamma);
    expect(call.vega).toBeCloseTo(0.3752, 4); // per 1 point of volatility
    expect(put.vega).toBe(call.vega);
    // Theta a year is -6.414 (call) and -1.658 (put); per calendar day, divide by 365.
    expect(call.theta * 365).toBeCloseTo(-6.414, 3);
    expect(put.theta * 365).toBeCloseTo(-1.658, 3);
  });

  it('obeys put-call parity: call - put = spot - strike x e^(-rT)', () => {
    const cases = [
      TEXTBOOK,
      { spot: 3100, strike: 3000, years: 7 / 365, rate: 0.06, vol: 0.22 },
      { spot: 820, strike: 900, years: 0.25, rate: 0.065, vol: 0.35 },
      { spot: 100_000, strike: 95_000, years: 2 / 365, rate: 0.04, vol: 0.6 },
    ];
    for (const input of cases) {
      const { call, put } = blackScholes(input);
      const parity = input.spot - input.strike * Math.exp(-input.rate * input.years);
      expect(call.price - put.price).toBeCloseTo(parity, 8);
      // The deltas are tied the same way: call delta - put delta = 1.
      expect(call.delta - put.delta).toBeCloseTo(1, 12);
    }
  });

  it('lets a deep in-the-money put gain value as time passes', () => {
    // Strike 150 against spot 100: the put is worth about the discounted strike
    // minus spot, and that discount shrinks as expiry nears.
    const { call, put } = blackScholes({ ...TEXTBOOK, strike: 150 });
    expect(put.theta).toBeGreaterThan(0);
    expect(call.theta).toBeLessThan(0);
  });

  it('returns intrinsic values at expiry', () => {
    const { call, put } = blackScholes({ ...TEXTBOOK, spot: 110, years: 0 });
    expect(call).toEqual({ price: 10, delta: 1, gamma: 0, theta: 0, vega: 0 });
    expect(put).toEqual({ price: 0, delta: 0, gamma: 0, theta: 0, vega: 0 });

    const below = blackScholes({ ...TEXTBOOK, spot: 90, years: 0 });
    expect(below.call.price).toBe(0);
    expect(below.put).toEqual({ price: 10, delta: -1, gamma: 0, theta: 0, vega: 0 });
  });
});
