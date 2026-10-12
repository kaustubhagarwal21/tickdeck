import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { validateOrder } from '@tickdeck/core';
import type { OrderRequest, Side } from '@tickdeck/core';
import { formatPrice } from '../format';
import { initialOrderForm, toOrderRequest, type OrderForm } from '../state/orderForm';
import { colors } from '../theme';

interface Props {
  symbol: string;
  /** Latest trade price, or undefined before the first trade. */
  last: number | undefined;
  onPlace: (req: OrderRequest) => void;
}

const SIDES: Side[] = ['BUY', 'SELL'];
const TYPES: OrderRequest['type'][] = ['MARKET', 'LIMIT', 'SL'];

/**
 * A small order ticket. It checks the order with the same validateOrder as
 * the web ticket while the user types, and only enables Place when it passes.
 */
export function OrderTicket({ symbol, last, onPlace }: Props) {
  const [form, setForm] = useState<OrderForm>(initialOrderForm);
  const update = (patch: Partial<OrderForm>) => setForm((f) => ({ ...f, ...patch }));

  const req = toOrderRequest(form, symbol);
  const error = validateOrder(req, last);
  const sideColor = form.side === 'BUY' ? colors.up : colors.down;

  function chooseType(type: OrderRequest['type']) {
    // Start a new LIMIT or SL order at the last price, which the user then adjusts.
    const price = type !== 'MARKET' && form.price === '' && last !== undefined ? formatPrice(last) : form.price;
    update({ type, price });
  }

  return (
    <View style={styles.ticket}>
      <View style={styles.segments}>
        {SIDES.map((side) => (
          <Segment
            key={side}
            label={side}
            active={form.side === side}
            activeColor={side === 'BUY' ? colors.up : colors.down}
            onPress={() => update({ side })}
          />
        ))}
      </View>
      <View style={styles.segments}>
        {TYPES.map((type) => (
          <Segment key={type} label={type} active={form.type === type} onPress={() => chooseType(type)} />
        ))}
      </View>

      <View style={styles.fields}>
        <Field label="Qty" value={form.qty} onChange={(qty) => update({ qty })} keyboard="number-pad" />
        {form.type === 'SL' && (
          <Field label="Trigger" value={form.trigger} onChange={(trigger) => update({ trigger })} keyboard="decimal-pad" />
        )}
        {form.type !== 'MARKET' && (
          <Field label="Price" value={form.price} onChange={(price) => update({ price })} keyboard="decimal-pad" />
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: error !== null }}
        disabled={error !== null}
        onPress={() => onPlace(req)}
        style={[styles.place, { backgroundColor: sideColor }, error !== null && styles.placeDisabled]}
      >
        <Text style={styles.placeText}>
          {form.side} {symbol}
        </Text>
      </Pressable>
    </View>
  );
}

function Segment(props: { label: string; active: boolean; activeColor?: string; onPress: () => void }) {
  const { label, active, activeColor = colors.fg, onPress } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <Text style={[styles.segmentText, { color: active ? activeColor : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  keyboard: 'number-pad' | 'decimal-pad';
}) {
  const { label, value, onChange, keyboard } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder="0"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { gap: 10 },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    borderRadius: 6,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 4 },
  segmentActive: { backgroundColor: colors.raised },
  segmentText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  fields: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { color: colors.muted, fontSize: 12 },
  input: {
    color: colors.fg,
    backgroundColor: colors.ink,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  error: { color: colors.down, fontSize: 13 },
  place: { alignItems: 'center', paddingVertical: 12, borderRadius: 6 },
  placeDisabled: { opacity: 0.4 },
  placeText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
});
