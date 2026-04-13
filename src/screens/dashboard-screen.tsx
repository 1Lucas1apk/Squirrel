import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PainelPrincipal } from "../components/dashboard/painel-principal";
import { mockLembretes, mockTransacoes } from "../data/mock-turno";
import { calcularTotaisTurno } from "../features/fechamento/calculos";
import { hasFirebaseConfig } from "../config/env";

export function DashboardScreen() {
  const totais = useMemo(
    () => calcularTotaisTurno(mockTransacoes, mockLembretes),
    []
  );

  const pendenciasFantasma = useMemo(
    () => mockLembretes.filter((item) => !item.resolvido).length,
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-ink-950">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pb-10 pt-4"
      >
        <View className="gap-1">
          <Text className="text-3xl font-black text-zinc-100 uppercase tracking-tighter">Squirrel</Text>
          <Text className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            Dashboard Offline (Mock)
          </Text>
        </View>

        {!hasFirebaseConfig() ? (
          <View className="rounded-3xl border border-red-500/20 bg-red-500/5 p-4">
            <Text className="text-[10px] font-black text-red-400 uppercase tracking-widest text-center">
              Firebase não configurado
            </Text>
          </View>
        ) : null}

        <PainelPrincipal totais={totais} pendenciasFantasma={pendenciasFantasma} />
      </ScrollView>
    </SafeAreaView>
  );
}
