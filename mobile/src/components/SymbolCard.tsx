import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OrderRequest, Quote } from '@tickdeck/core';
import { formatPrice, formatSigned } from '../format';
import { colors, signColor } from '../theme';
import { OrderTicket } from './OrderTicket';

interface Props {
  symbol: string;
  quote: Quote | undefined;
  onPlace: (req: OrderRequest) => void;
  onClose: () => void;
}

/** Detail card for the tapped symbol: last price, change, and an order ticket. */
export function SymbolCard({ symbol, quote, onPlace, onClose }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={onClose} hitSlop={8}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {quote ? (
        <View style={styles.priceRow}>
          <Text style={styles.last}>{formatPrice(quote.last)}</Text>
          <Text style={[styles.change, { color: signColor(quote.change) }]}>
            {formatSigned(quote.change)} ({formatSigned(quote.changePct)}%)
          </Text>
        </View>
      ) : (
        <Text style={styles.muted}>Waiting for the first trade...</Text>
      )}
      {quote && <Text style={styles.muted}>Change since the first trade at {formatPrice(quote.open)}</Text>}

      {/* key: a new symbol gets a fresh ticket instead of the previous symbol's inputs. */}
      <OrderTicket key={symbol} symbol={symbol} last={quote?.last} onPlace={onPlace} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  symbol: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  close: { color: colors.muted, fontSize: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  last: { color: colors.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  change: { fontSize: 15, fontVariant: ['tabular-nums'] },
  muted: { color: colors.muted, fontSize: 12 },
});
