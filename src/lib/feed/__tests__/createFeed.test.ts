import { BINANCE_SYMBOLS, SIM_SYMBOLS } from '@tickdeck/core';
import { MAX_TICKS_PER_SECOND, createFeed, parseFeedParams, symbolsFor } from '../createFeed';

const parse = (query: string) => parseFeedParams(new URLSearchParams(query));

describe('parseFeedParams', () => {
  it('defaults to Binance, with the default simulated rate of 400 a second', () => {
    expect(parse('')).toEqual({ kind: 'binance', ticksPerSecond: 400 });
  });

  it('selects the simulated feed with ?feed=sim', () => {
    expect(parse('feed=sim').kind).toBe('simulated');
    expect(parse('feed=binance').kind).toBe('binance');
    expect(parse('feed=unknown').kind).toBe('binance');
  });

  it('reads ?rate= and caps it', () => {
    expect(parse('feed=sim&rate=1000').ticksPerSecond).toBe(1000);
    expect(parse('rate=0.5').ticksPerSecond).toBe(0.5);
    expect(parse('rate=999999').ticksPerSecond).toBe(MAX_TICKS_PER_SECOND);
  });

  it.each(['rate=0', 'rate=-5', 'rate=fast', 'rate='])('ignores %s', (query) => {
    expect(parse(query).ticksPerSecond).toBe(400);
  });
});

describe('createFeed', () => {
  it('creates a feed of the requested kind without connecting it', () => {
    expect(createFeed('simulated').kind).toBe('simulated');
    expect(createFeed('binance').kind).toBe('binance');
  });
});

describe('symbolsFor', () => {
  it('returns the instruments each feed streams', () => {
    expect(symbolsFor('simulated')).toBe(SIM_SYMBOLS);
    expect(symbolsFor('binance')).toBe(BINANCE_SYMBOLS);
  });
});
