import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated, Easing } from 'react-native';
import { X, Sparkles, TrendingUp, Calendar, Target, Award, Info, Banknote, ShieldCheck, Zap, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react-native';
import { Turno } from '../types/domain';
import { toBrl } from '../utils/currency';

const { width, height } = Dimensions.get('window');

interface RetrospectiveScreenProps {
  turnos: Turno[];
  onClose: () => void;
}

const AnimatedCard = ({ children, index, color }: { children: React.ReactNode, index: number, color: string }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 600,
      delay: index * 100,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View style={[
      styles.card, 
      { opacity, transform: [{ translateY }], borderColor: `${color}20` }
    ]}>
      {children}
    </Animated.View>
  );
};

export function RetrospectiveScreen({ turnos, onClose }: RetrospectiveScreenProps) {
  const stats = useMemo(() => {
    if (turnos.length === 0) return null;

    const totalDias = turnos.length;
    const totalSistema = turnos.reduce((acc, t) => acc + (t.totais?.sistema || 0), 0);
    const mediaPorDia = totalSistema / totalDias;
    
    // Dia Recorde
    const sortedBySistema = [...turnos].sort((a, b) => (b.totais?.sistema || 0) - (a.totais?.sistema || 0));
    const diaRecorde = sortedBySistema[0];
    
    // Dia Mais Difícil (Maior Quebra)
    const diaDificil = [...turnos].sort((a, b) => (a.totais?.sobra || 0) - (b.totais?.sobra || 0))[0];
    
    // Sobras e Quebras
    const totalSobra = turnos.reduce((acc, t) => acc + (t.totais?.sobra || 0), 0);
    const diasPerfeitos = turnos.filter(t => t.totais?.sobra === 0).length;
    const taxaPrecisao = (diasPerfeitos / totalDias) * 100;

    // Volume Financeiro
    const totalDinheiroSaco = turnos.reduce((acc, t) => acc + (t.totais?.especieEnvelope || 0), 0);
    const totalPixRepasse = turnos.reduce((acc, t) => acc + (t.totais?.pixRepasse || 0), 0);
    
    // Título do Operador
    let titulo = "Iniciante";
    let subTitulo = "Começando a trilha agora.";
    if (totalDias > 5) { titulo = "Operador Fiel"; subTitulo = "Mantendo o caixa em ordem."; }
    if (taxaPrecisao > 80 && totalDias > 10) { titulo = "Mestre da Gaveta"; subTitulo = "Precisão cirúrgica no fechamento."; }
    if (totalSistema > 50000) { titulo = "Elite Squirrel"; subTitulo = "Volume pesado sob controle."; }

    return {
      totalDias,
      totalSistema,
      mediaPorDia,
      diaRecorde,
      diaDificil,
      totalSobra,
      diasPerfeitos,
      taxaPrecisao,
      totalDinheiroSaco,
      totalPixRepasse,
      titulo,
      subTitulo
    };
  }, [turnos]);

  if (!stats) {
    return (
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Pressable onPress={onClose} style={styles.closeButton}><X color="#71717a" size={24} /></Pressable>
          <Info size={48} color="#71717a" style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Sem dados ainda</Text>
          <Text style={styles.subtitle}>Siga usando o app para gerar seus insights!</Text>
        </View>
      </View>
    );
  }

  const insightCards = [
    { title: "Volume Total", value: toBrl(stats.totalSistema), desc: `Movimentados em ${stats.totalDias} turnos.`, icon: TrendingUp, color: "#a78bfa" },
    { title: "Média Diária", value: toBrl(stats.mediaPorDia), desc: "Volume médio por abertura.", icon: Calendar, color: "#60a5fa" },
    { title: "Dia de Ouro", value: toBrl(stats.diaRecorde.totais?.sistema || 0), desc: `Seu recorde em ${stats.diaRecorde.dataReferencia}.`, icon: Award, color: "#fb923c" },
    { title: "Dia Desafiador", value: toBrl(stats.diaDificil.totais?.sobra || 0), desc: `Maior divergência em ${stats.diaDificil.dataReferencia}.`, icon: Zap, color: "#f87171" },
    { title: "Precisão", value: `${Math.round(stats.taxaPrecisao)}%`, desc: `${stats.diasPerfeitos} dias de caixa perfeito.`, icon: Target, color: "#34d399" },
    { title: "Total Malote", value: toBrl(stats.totalDinheiroSaco), desc: "Dinheiro físico enviado em sacos.", icon: Banknote, color: "#2dd4bf" },
    { title: "Total Repasse", value: toBrl(stats.totalPixRepasse), desc: "Total transferido via Pix.", icon: ArrowUpRight, color: "#818cf8" },
    { title: "Atividade", value: `${stats.totalDias} Dias`, desc: "Sessões de trabalho registradas.", icon: Clock, color: "#94a3b8" },
  ];

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.sparkleContainer}>
            <Sparkles size={24} color="#facc15" />
            <Text style={styles.headerLabel}>Performance Histórica</Text>
          </View>
          <Pressable onPress={onClose} style={styles.headerClose}>
            <X color="#71717a" size={20} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* RANKING SECTION */}
          <View style={styles.rankingBox}>
             <View style={styles.medalCircle}>
                <ShieldCheck size={32} color="#34d399" />
             </View>
             <Text style={styles.rankingTitle}>{stats.titulo}</Text>
             <Text style={styles.rankingSubtitle}>{stats.subTitulo}</Text>
          </View>

          <View style={styles.grid}>
            {insightCards.map((card, index) => (
              <AnimatedCard key={index} index={index} color={card.color}>
                <View style={[styles.iconBadge, { backgroundColor: `${card.color}15` }]}>
                  <card.icon size={18} color={card.color} strokeWidth={2.5} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
                  <Text style={styles.cardDesc}>{card.desc}</Text>
                </View>
              </AnimatedCard>
            ))}
          </View>

          <View style={styles.sobraBox}>
            <Text style={styles.sobraLabel}>Balanço Acumulado de Sobras</Text>
            <Text style={[styles.sobraValue, { color: stats.totalSobra >= 0 ? '#34d399' : '#f87171' }]}>
              {toBrl(stats.totalSobra)}
            </Text>
            <View style={styles.sobraStatus}>
              {stats.totalSobra >= 0 ? <ArrowUpRight size={14} color="#34d399" /> : <ArrowDownRight size={14} color="#f87171" />}
              <Text style={styles.sobraDesc}>
                {stats.totalSobra >= 0 
                  ? "Saldo positivo nas sobras acumuladas." 
                  : "Atenção: Quebras superando as sobras."}
              </Text>
            </View>
          </View>
          
          <View style={styles.footerSpacing} />
        </ScrollView>

        <Pressable onPress={onClose} style={styles.footerButton}>
          <Text style={styles.footerButtonText}>Continuar Evoluindo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#050505',
    padding: 24,
    paddingTop: 60,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  sparkleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerClose: {
    padding: 8,
    backgroundColor: '#18181b',
    borderRadius: 12,
  },
  rankingBox: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: '#111111',
    padding: 32,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#222',
  },
  medalCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  rankingTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  rankingSubtitle: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: 'bold',
    marginTop: 4,
    textTransform: 'uppercase',
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
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    width: (width - 60) / 2,
    backgroundColor: '#0c0c0c',
    borderRadius: 32,
    borderWidth: 1,
    padding: 20,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#52525b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  cardDesc: {
    fontSize: 9,
    fontWeight: '600',
    color: '#3f3f46',
    lineHeight: 12,
  },
  sobraBox: {
    backgroundColor: '#0c0c0c',
    borderRadius: 32,
    padding: 32,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  sobraLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#52525b',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sobraValue: {
    fontSize: 38,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -1.5,
  },
  sobraStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sobraDesc: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
  },
  footerSpacing: {
    height: 100,
  },
  footerButton: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 20,
    alignItems: 'center',
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.5)',
    elevation: 10,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
