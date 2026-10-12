import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SIM_SYMBOLS } from '@tickdeck/core';
import { Orders } from './src/components/Orders';
import { Positions } from './src/components/Positions';
import { SymbolCard } from './src/components/SymbolCard';
import { Watchlist } from './src/components/Watchlist';
import { useTerminal } from './src/state/useTerminal';
import { colors } from './src/theme';

/** TickDeck mobile: one scrolling screen with the watchlist, a symbol card, orders and positions. */
export default function App() {
  const { state, placeOrder, cancelOrder } = useTerminal();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>TickDeck</Text>
            <Text style={styles.badge}>Simulated</Text>
          </View>

          <Watchlist
            symbols={SIM_SYMBOLS}
            quotes={state.quotes}
            selected={selected}
            onSelect={(symbol) => setSelected((current) => (current === symbol ? null : symbol))}
          />

          {selected && (
            <SymbolCard
              symbol={selected}
              quote={state.quotes[selected]}
              onPlace={placeOrder}
              onClose={() => setSelected(null)}
            />
          )}

          <Positions positions={state.positions} quotes={state.quotes} />
          <Orders orders={state.orders} onCancel={cancelOrder} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  logo: { color: colors.accent, fontSize: 20, fontWeight: '700' },
  badge: {
    color: colors.accent,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
