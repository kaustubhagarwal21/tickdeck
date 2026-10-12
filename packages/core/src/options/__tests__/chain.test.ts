import * as core from '@tickdeck/core';
import {
  buildChain,
  nextExpiry,
  nextMonthlyExpiry,
  nextWeeklyExpiry,
  smileIv,
  strikeStepFor,
  type ChainParams,
} from '../chain';

/** Epoch ms of a time in India (IST = UTC+5:30). Month is 1-12 here for readability. */
function ist(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) - 330 * 60 * 1000;
}

// Monday 12 October 2026, 09:30 IST.
const MONDAY = ist(2026, 10, 12, 9, 30);

const PARAMS: ChainParams = {
  spot: 3107,
  strikeStep: 25,
  strikesEachSide: 10,
  nowMs: MONDAY,
  expiryMs: MONDAY + 30 * 24 * 60 * 60 * 1000, // 30 days out
  rate: 0.06,
  ivAtm: 0.2,
  smile: 3,
};

describe('buildChain', () => {
  const rows = buildChain(PARAMS);

  it('lists strikes evenly around the ATM strike, lowest first', () => {
    expect(rows).toHaveLength(21);
    expect(rows[0].strike).toBe(2850);
    expect(rows[20].strike).toBe(3350);
    rows.forEach((row, i) => i > 0 && expect(row.strike - rows[i - 1].strike).toBe(25));
  });

  it('marks the strike nearest spot as ATM, and only that one', () => {
    expect(rows.filter((r) => r.isAtm).map((r) => r.strike)).toEqual([3100]);
    // 3113 is nearer 3125 than 3100.
    const higher = buildChain({ ...PARAMS, spot: 3113 });
    expect(higher.find((r) => r.isAtm)?.strike).toBe(3125);
  });

  it('flags calls below spot and puts above spot as in the money', () => {
    for (const row of rows) {
      expect(row.call.itm).toBe(row.strike < 3107);
      expect(row.put.itm).toBe(row.strike > 3107);
    }
    // The ATM strike 3100 is just below spot 3107: its call is ITM, its put is not.
    const atm = rows.find((r) => r.isAtm)!;
    expect(atm.call.itm).toBe(true);
    expect(atm.put.itm).toBe(false);
  });

  it('prices calls lower and puts higher as the strike rises', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].call.price).toBeLessThan(rows[i - 1].call.price);
      expect(rows[i].put.price).toBeGreaterThan(rows[i - 1].put.price);
    }
  });

  it('gives Greeks the right signs', () => {
    for (const { call, put } of rows) {
      expect(call.delta).toBeGreaterThan(0);
      expect(call.delta).toBeLessThan(1);
      expect(put.delta).toBeLessThan(0);
      expect(put.delta).toBeGreaterThan(-1);
      expect(call.gamma).toBeGreaterThan(0);
      expect(call.vega).toBeGreaterThan(0);
      expect(call.theta).toBeLessThan(0); // a call always loses value as time passes
    }
    // Near the money, time decay hurts the put too.
    expect(rows.find((r) => r.isAtm)!.put.theta).toBeLessThan(0);
    // Call delta falls as the strike rises.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].call.delta).toBeLessThan(rows[i - 1].call.delta);
    }
  });

  it('uses a volatility smile: IV is lowest near spot and higher on both wings', () => {
    const ivs = rows.map((r) => r.call.iv);
    const lowest = Math.min(...ivs);
    expect(rows.find((r) => r.call.iv === lowest)?.isAtm).toBe(true);
    expect(rows[0].call.iv).toBeGreaterThan(rows[10].call.iv);
    expect(rows[20].call.iv).toBeGreaterThan(rows[10].call.iv);
    // The call and the put at a strike share its IV.
    rows.forEach((r) => expect(r.put.iv).toBe(r.call.iv));
    expect(smileIv(0.2, 3, 100, 100)).toBe(0.2);
    expect(smileIv(0.2, 3, 100, 110)).toBeCloseTo(0.2 + 3 * Math.log(1.1) ** 2, 12);
  });

  it('returns no rows without a usable price', () => {
    expect(buildChain({ ...PARAMS, spot: 0 })).toEqual([]);
    expect(buildChain({ ...PARAMS, strikeStep: 0 })).toEqual([]);
  });

  it('skips strikes at or below zero', () => {
    const cheap = buildChain({ ...PARAMS, spot: 2, strikeStep: 0.5 });
    expect(cheap[0].strike).toBe(0.5);
    expect(cheap.every((r) => r.strike > 0)).toBe(true);
  });

  it('keeps fractional strikes free of floating-point noise', () => {
    const doge = buildChain({ ...PARAMS, spot: 0.21345, strikeStep: 0.001 });
    expect(doge.find((r) => r.isAtm)?.strike).toBe(0.213);
    expect(doge[0].strike).toBe(0.203);
  });
});

describe('strikeStepFor', () => {
  it('picks about 1% of the price, rounded down to 1, 2.5 or 5 x a power of ten', () => {
    expect(strikeStepFor(3100)).toBe(25); // TCS
    expect(strikeStepFor(1450)).toBe(10); // RELIANCE
    expect(strikeStepFor(820)).toBe(5); // SBIN
    expect(strikeStepFor(150)).toBe(1); // SOL
    expect(strikeStepFor(100_000)).toBe(1000); // BTC
    expect(strikeStepFor(0.2)).toBe(0.001); // DOGE
  });

  it('falls back to 1 for a price that is not positive', () => {
    expect(strikeStepFor(0)).toBe(1);
    expect(strikeStepFor(Number.NaN)).toBe(1);
  });
});

describe('expiries', () => {
  it('finds the coming Tuesday at 15:30 IST for the weekly expiry', () => {
    expect(nextWeeklyExpiry(MONDAY)).toBe(ist(2026, 10, 13, 15, 30));
  });

  it('uses the IST date, not the UTC one', () => {
    // 01:30 IST on Tuesday is still Monday in UTC. The expiry is the same day, 14 hours later.
    expect(nextWeeklyExpiry(ist(2026, 10, 13, 1, 30))).toBe(ist(2026, 10, 13, 15, 30));
  });

  it('rolls to next week once Tuesday 15:30 has passed', () => {
    expect(nextWeeklyExpiry(ist(2026, 10, 13, 15, 29))).toBe(ist(2026, 10, 13, 15, 30));
    expect(nextWeeklyExpiry(ist(2026, 10, 13, 15, 30))).toBe(ist(2026, 10, 20, 15, 30));
  });

  it('finds the last Tuesday of the month for the monthly expiry', () => {
    expect(nextMonthlyExpiry(MONDAY)).toBe(ist(2026, 10, 27, 15, 30));
    // After October's expiry, November's last Tuesday (the 30th is a Monday).
    expect(nextMonthlyExpiry(ist(2026, 10, 28))).toBe(ist(2026, 11, 24, 15, 30));
    // After December's expiry, it rolls into January of the next year.
    expect(nextMonthlyExpiry(ist(2026, 12, 30))).toBe(ist(2027, 1, 26, 15, 30));
  });

  it('picks the expiry by kind', () => {
    expect(nextExpiry('weekly', MONDAY)).toBe(nextWeeklyExpiry(MONDAY));
    expect(nextExpiry('monthly', MONDAY)).toBe(nextMonthlyExpiry(MONDAY));
  });
});

describe('@tickdeck/core barrel', () => {
  it('exports the option pricing and chain functions', () => {
    const names = [
      'normCdf',
      'normPdf',
      'blackScholes',
      'buildChain',
      'smileIv',
      'strikeStepFor',
      'nextWeeklyExpiry',
      'nextMonthlyExpiry',
      'nextExpiry',
    ];
    expect(names.filter((name) => !(name in core))).toEqual([]);
  });
});
