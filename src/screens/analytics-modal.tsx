import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Dimensions } from 'react-native';
import { X, TrendingUp, BarChart2, Clock, Wallet, ArrowRight } from 'lucide-react-native';
import { LineChart } from "react-native-wagmi-charts";
import { Transacao, TotaisTurno } from '../types/domain';
import { toBrl } from '../utils/currency';
import { TabSwitcher } from '../components/common/tab-switcher';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  transacoes: Transacao[];
  totais: TotaisTurno;
}

export function AnalyticsModal({ visible, onClose, transacoes, totais }: AnalyticsModalProps) {
  const [activeTab, setActiveTab] = useState("timeline");

  // 1. Processar dados para o Fluxo de Caixa (Timeline)
  const chartData = useMemo(() => {
    if (transacoes.length === 0) return [];
    
    // Ordena por tempo (antigo para novo) para o gráfico de fluxo
    const sorted = [...transacoes].sort((a, b) => a.timestamp - b.timestamp);
    
    let runningBalance = 0;
    
    return sorted.map(t => {
      const isSaida = t.categoria === "sangria" || t.categoria === "cancelamento";
      
      // O desempenho real considera entradas (+) e saídas (-)
      if (isSaida) {
        runningBalance -= t.valorSistema;
      } else {
        // Usamos o valor real recebido para refletir o que de fato entrou na gaveta
        runningBalance += t.valorRecebidoFisico;
      }
      
      return {
        timestamp: t.timestamp,
        value: runningBalance,
      };
    });
  }, [transacoes]);

  // 2. Processar dados para o Balanço por Hora
  const hourlyData = useMemo(() => {
    const hours: Record<number, { count: number; value: number }> = {};
    
    // Horário comercial expandido
    for (let i = 7; i <= 22; i++) hours[i] = { count: 0, value: 0 };

    transacoes.forEach(t => {
      const h = new Date(t.timestamp).getHours();
      if (hours[h]) {
        hours[h].count += 1;
        const isSaida = t.categoria === "sangria" || t.categoria === "cancelamento";
        // Soma entradas e subtrai saídas por hora
        hours[h].value += isSaida ? -t.valorSistema : t.valorRecebidoFisico;
      }
    });

    return Object.entries(hours).map(([hour, data]) => ({
      hour: parseInt(hour),
      ...data
    }));
  }, [transacoes]);

  const maxHourlyValue = Math.max(...hourlyData.map(d => Math.abs(d.value)), 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Mapa de Movimentação</Text>
              <Text style={styles.headerSubtitle}>Rastro financeiro do expediente</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X color="#71717a" size={24} />
            </Pressable>
          </View>

          <TabSwitcher 
            tabs={[
              { key: "timeline", label: "Trilha da Gaveta" },
              { key: "heatmap", label: "Picos de Horário" }
            ]}
            activeKey={activeTab}
            onChange={setActiveTab}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {activeTab === "timeline" ? (
              <View style={styles.section}>
                <View style={styles.cardInfo}>
                   <TrendingUp size={16} color="#60a5fa" />
                   <Text style={styles.cardInfoText}>Acompanhe como o volume de notas oscilou conforme as vendas e retiradas.</Text>
                </View>

                {chartData.length >= 2 ? (
                  <View style={styles.chartContainer}>
                    <LineChart.Provider data={chartData}>
                      <LineChart height={200} width={SCREEN_WIDTH - 80}>
                        <LineChart.Path color="#60a5fa" width={4}>
                          <LineChart.Gradient color="#60a5fa" />
                        </LineChart.Path>
                        <LineChart.CursorCrosshair color="#f4f4f5">
                          <LineChart.Tooltip textStyle={{ color: '#fff', fontWeight: 'bold' }} />
                        </LineChart.CursorCrosshair>
                      </LineChart>
                    </LineChart.Provider>
                    <View style={styles.chartLabels}>
                      <Text style={styles.chartLabel}>Abertura</Text>
                      <Text style={styles.chartLabel}>Agora</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Clock size={40} color="#27272a" />
                    <Text style={styles.emptyText}>Lance os primeiros registros para ver a trilha de saldo.</Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                   <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Máximo Atingido</Text>
                      <Text style={styles.statValue}>{toBrl(Math.max(...chartData.map(d => d.value), 0))}</Text>
                   </View>
                   <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Total em Mãos</Text>
                      <Text style={[styles.statValue, { color: '#34d399' }]}>{toBrl(totais.gavetaFisico)}</Text>
                   </View>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.cardInfo}>
                   <BarChart2 size={16} color="#a78bfa" />
                   <Text style={styles.cardInfoText}>Identifique os momentos de maior e menor giro de caixa na loja.</Text>
                </View>

                <View style={styles.heatmapContainer}>
                  {hourlyData.map((item) => {
                    const barHeight = (Math.abs(item.value) / maxHourlyValue) * 120;
                    const hasValue = Math.abs(item.value) > 0;

                    return (
                      <View key={item.hour} style={styles.heatmapBarWrapper}>
                        <View style={styles.barLabelTop}>
                           {item.count > 0 && <Text style={styles.barCount}>{item.count}x</Text>}
                        </View>
                        <View 
                          style={[
                            styles.heatmapBar, 
                            { 
                              height: Math.max(barHeight, 4), 
                              backgroundColor: hasValue ? (item.value >= 0 ? '#a78bfa' : '#f87171') : '#18181b',
                              opacity: hasValue ? 1 : 0.3
                            }
                          ]} 
                        />
                        <Text style={styles.heatmapBarLabel}>{item.hour}h</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.legendRow}>
                   <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#a78bfa' }]} />
                      <Text style={styles.legendText}>Saldo Positivo</Text>
                   </View>
                   <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#f87171' }]} />
                      <Text style={styles.legendText}>Saldo Negativo</Text>
                   </View>
                </View>
              </View>
            )}

            <View style={styles.footerInfo}>
               <Wallet size={14} color="#71717a" />
               <Text style={styles.footerText}>
                 A análise considera apenas os dados deste turno ({totais.sistema > 0 ? 'Ativo' : 'Vazio'}).
               </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#09090b',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderWidth: 1,
    borderColor: '#27272a',
    height: '85%',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#18181b',
    borderRadius: 16,
  },
  scroll: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    gap: 24,
  },
  cardInfo: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#18181b',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardInfoText: {
    flex: 1,
    fontSize: 11,
    color: '#a1a1aa',
    fontWeight: '600',
    lineHeight: 16,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 12,
  },
  chartLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#3f3f46',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#52525b',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f4f4f5',
  },
  heatmapContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    paddingHorizontal: 4,
    backgroundColor: '#0f0f0f',
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  heatmapBarWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  barLabelTop: {
    height: 12,
    justifyContent: 'center',
  },
  barCount: {
    fontSize: 7,
    fontWeight: 'black',
    color: '#71717a',
  },
  heatmapBar: {
    width: 10,
    borderRadius: 4,
  },
  heatmapBarLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#3f3f46',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#52525b',
    textTransform: 'uppercase',
  },
  emptyState: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 12,
    color: '#3f3f46',
    textAlign: 'center',
    fontWeight: 'bold',
    maxWidth: '80%',
  },
  footerInfo: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.5,
  },
  footerText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#71717a',
    textTransform: 'uppercase',
  }
});
