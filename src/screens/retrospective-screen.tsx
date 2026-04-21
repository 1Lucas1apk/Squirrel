import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { X, Sparkles, TrendingUp, Calendar, Target, Award, Info } from 'lucide-react-native';
import { Turno } from '../types/domain';
import { toBrl } from '../utils/currency';

const { width } = Dimensions.get('window');

interface RetrospectiveScreenProps {
  turnos: Turno[];
  onClose: () => void;
}

export function RetrospectiveScreen({ turnos, onClose }: RetrospectiveScreenProps) {
  const stats = useMemo(() => {
    if (turnos.length === 0) return null;

    const totalDias = turnos.length;
    const totalSistema = turnos.reduce((acc, t) => acc + (t.totais?.sistema || 0), 0);
    const mediaPorDia = totalSistema / totalDias;
    
    // Dia com maior faturamento
    const diaRecorde = [...turnos].sort((a, b) => (b.totais?.sistema || 0) - (a.totais?.sistema || 0))[0];
    
    // Total de sobras/quebras
    const totalSobra = turnos.reduce((acc, t) => acc + (t.totais?.sobra || 0), 0);
    
    // Dias com caixa perfeito (sobra = 0)
    const diasPerfeitos = turnos.filter(t => t.totais?.sobra === 0).length;

    return {
      totalDias,
      totalSistema,
      mediaPorDia,
      diaRecorde,
      totalSobra,
      diasPerfeitos,
    };
  }, [turnos]);

  if (!stats) {
    return (
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Pressable onPress={onClose} style={styles.closeButton}><X color="#71717a" size={24} /></Pressable>
          <Info size={48} color="#71717a" style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Sem dados ainda</Text>
          <Text style={styles.subtitle}>Continue usando o Squirrel para ver sua retrospectiva!</Text>
        </View>
      </View>
    );
  }

  const cards = [
    {
      title: "Volume Total",
      value: toBrl(stats.totalSistema),
      desc: `Movimentados em ${stats.totalDias} dias registrados.`,
      icon: TrendingUp,
      color: "#a78bfa"
    },
    {
      title: "Média Diária",
      value: toBrl(stats.mediaPorDia),
      desc: "Este é o seu fluxo médio por turno.",
      icon: Calendar,
      color: "#60a5fa"
    },
    {
      title: "Dia Recorde",
      value: toBrl(stats.diaRecorde.totais?.sistema || 0),
      desc: `Ocorreu em ${stats.diaRecorde.dataReferencia}.`,
      icon: Award,
      color: "#fb923c"
    },
    {
      title: "Caixa Perfeito",
      value: `${stats.diasPerfeitos} Dias`,
      desc: "Vezes que o caixa bateu 100% sem sobras.",
      icon: Target,
      color: "#34d399"
    }
  ];

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.sparkleContainer}>
            <Sparkles size={24} color="#facc15" />
            <Text style={styles.headerLabel}>Curiosidades</Text>
          </View>
          <Text style={styles.headerTitle}>Você Sabia?</Text>
          <Pressable onPress={onClose} style={styles.headerClose}>
            <X color="#71717a" size={20} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.grid}>
            {cards.map((card, index) => (
              <View key={index} style={[styles.card, { borderColor: `${card.color}20` }]}>
                <View style={[styles.iconBadge, { backgroundColor: `${card.color}10` }]}>
                  <card.icon size={20} color={card.color} />
                </View>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
                <Text style={styles.cardDesc}>{card.desc}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sobraBox}>
            <Text style={styles.sobraLabel}>Saldo Acumulado de Sobras</Text>
            <Text style={[styles.sobraValue, { color: stats.totalSobra >= 0 ? '#34d399' : '#f87171' }]}>
              {toBrl(stats.totalSobra)}
            </Text>
            <Text style={styles.sobraDesc}>
              {stats.totalSobra >= 0 
                ? "Você está com saldo positivo nas sobras acumuladas!" 
                : "Atenção: Suas quebras estão superando as sobras."}
            </Text>
          </View>
        </ScrollView>

        <Pressable onPress={onClose} style={styles.footerButton}>
          <Text style={styles.footerButtonText}>Incrível!</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  container: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#09090b',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  sparkleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#facc15',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f4f4f5',
    position: 'absolute',
    top: 24,
    left: 0,
  },
  headerClose: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f4f4f5',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#71717a',
    textAlign: 'center',
    marginTop: 8,
  },
  scrollContent: {
    paddingTop: 32,
    paddingBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    width: (width - 88) / 2,
    backgroundColor: '#18181b',
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71717a',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 9,
    fontWeight: '600',
    color: '#3f3f46',
    lineHeight: 12,
  },
  sobraBox: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 24,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
  },
  sobraLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71717a',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sobraValue: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -1,
  },
  sobraDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: '#52525b',
    textAlign: 'center',
  },
  footerButton: {
    backgroundColor: '#f4f4f5',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#09090b',
    textTransform: 'uppercase',
  },
});
