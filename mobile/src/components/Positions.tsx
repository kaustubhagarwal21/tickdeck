import { StyleSheet, Text, View } from 'react-native';
import type { Position, Quote } from '@tickdeck/core';
import { formatPrice, formatSigned } from '../format';
import { colors, signColor } from '../theme';

interface Props {
  positions: Record<string, Position>;
  quotes: Record<string, Quote>;
}

/**
 * Open positions with unrealised P&L: (last - average price) x quantity.
 * The quantity is signed, so the same formula is right for shorts.
 */
export function Positions({ positions, quotes }: Props) {
  const list = Object.values(positions);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Positions</Text>
      {list.length === 0 && <Text style={styles.empty}>No open positions. Place an order above.</Text>}
      {list.map((p) => {
        const last = quotes[p.symbol]?.last ?? p.avgPrice;
        const pnl = (last - p.avgPrice) * p.qty;
        return (
          <View key={p.symbol} style={styles.row}>
            <View>
              <Text style={styles.symbol}>{p.symbol}</Text>
              <Text style={styles.detail}>
                {p.qty > 0 ? 'Long' : 'Short'} {Math.abs(p.qty)} @ {formatPrice(p.avgPrice)}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.pnl, { color: signColor(pnl) }]}>{formatSigned(pnl)}</Text>
              <Text style={styles.detail}>LTP {formatPrice(last)}</Text>
            </View>
          </View>
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
    padding: 12,
    gap: 8,
  },
  title: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  empty: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  symbol: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  right: { alignItems: 'flex-end' },
  pnl: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
