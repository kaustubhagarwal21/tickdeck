import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Quote } from '@tickdeck/core';
import { formatPrice, formatSigned } from '../format';
import { colors, signColor } from '../theme';

interface Props {
  symbols: string[];
  quotes: Record<string, Quote>;
  selected: string | null;
  onSelect: (symbol: string) => void;
}

/** One row per symbol: name, last price and change since the first trade. Tap to open it. */
export function Watchlist({ symbols, quotes, selected, onSelect }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Watchlist</Text>
      {symbols.map((symbol) => {
        const quote = quotes[symbol];
        const isSelected = symbol === selected;
        return (
          <Pressable
            key={symbol}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${symbol}, open details`}
            onPress={() => onSelect(symbol)}
            style={[styles.row, isSelected && styles.rowSelected]}
          >
            <Text style={styles.symbol}>{symbol}</Text>
            {quote ? (
              <View style={styles.numbers}>
                {/* The last price is green or red for the direction of the latest move. */}
                <Text style={[styles.price, { color: quote.dir === 0 ? colors.fg : signColor(quote.dir) }]}>
                  {formatPrice(quote.last)}
                </Text>
                <Text style={[styles.change, { color: signColor(quote.change) }]}>
                  {formatSigned(quote.changePct)}%
                </Text>
              </View>
            ) : (
              <Text style={styles.waiting}>waiting...</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
  },
  title: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  rowSelected: {
    backgroundColor: colors.raised,
    borderLeftColor: colors.accent,
  },
  symbol: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  numbers: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  // tabular-nums keeps every digit the same width, so prices do not jitter as they change.
  price: { fontSize: 15, fontVariant: ['tabular-nums'], minWidth: 72, textAlign: 'right' },
  change: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 60, textAlign: 'right' },
  waiting: { color: colors.muted, fontSize: 13 },
});
