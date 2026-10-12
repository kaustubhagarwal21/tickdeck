import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isWorking } from '@tickdeck/core';
import type { Order, OrderRequest } from '@tickdeck/core';
import { formatPrice } from '../format';
import { colors } from '../theme';

interface Props {
  orders: Order[];
  onCancel: (id: string) => void;
}

/** The order's prices in words, for example "LIMIT 1450.00" or "SL 1460.00 / 1461.00". */
function describe(req: OrderRequest): string {
  if (req.type === 'MARKET') return 'MARKET';
  if (req.type === 'LIMIT') return `LIMIT ${formatPrice(req.price)}`;
  return `SL ${formatPrice(req.trigger)} / ${formatPrice(req.price)}`;
}

/** Orders placed this session, newest first. Working orders can be cancelled. */
export function Orders({ orders, onCancel }: Props) {
  if (orders.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Orders</Text>
      {orders.map((o) => (
        <View key={o.id} style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.main}>
              <Text style={{ color: o.req.side === 'BUY' ? colors.up : colors.down }}>{o.req.side}</Text> {o.req.qty}{' '}
              {o.req.symbol}
            </Text>
            <Text style={styles.detail}>
              {describe(o.req)} · {o.status}
              {o.fillPrice !== undefined ? ` @ ${formatPrice(o.fillPrice)}` : ''}
            </Text>
            {o.reason && <Text style={styles.reason}>{o.reason}</Text>}
          </View>
          {isWorking(o) && (
            <Pressable accessibilityRole="button" onPress={() => onCancel(o.id)} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      ))}
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
    gap: 10,
  },
  title: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  info: { flex: 1 },
  main: { color: colors.fg, fontSize: 14, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  reason: { color: colors.down, fontSize: 12 },
  cancel: { borderColor: colors.line, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  cancelText: { color: colors.fg, fontSize: 12 },
});
