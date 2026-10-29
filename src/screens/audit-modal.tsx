import React, { useState, useMemo } from "react";
import { 
  View, 
  Text, 
  Pressable, 
  FlatList, 
  TextInput, 
  Platform, 
  Modal, 
  Clipboard,
  ScrollView,
  StyleSheet 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  Activity, 
  X, 
  Search, 
  ArrowDownRight, 
  ArrowUpRight, 
  Edit3, 
  Ghost, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  Zap, 
  Wallet, 
  QrCode, 
  Banknote,
  Info,
  ChevronDown,
  ChevronUp,
  Terminal,
  FileCode,
  Layers,
  Database,
  Hash,
  User,
  Shield,
  FileCheck,
  CloudCheck,
  Tag
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Transacao, LembreteFantasma, LogAlteracao, TotaisTurno } from "../types/domain";
import { toBrl } from "../utils/currency";

export interface AuditEventItem {
  id: string;
  dbId: string;
  actionCode: string;
  type: "transacao" | "fantasma" | "log";
  categoria: string;
  titulo: string;
  descricao: string;
  pessoa?: string;
  codigoContrato?: string;
  naturezaOperacao?: string;
  valorSistema: number;
  valorRecebidoFisico?: number;
  diferencaFisica?: number;
  tipoFluxo: "entrada" | "saida" | "neutro";
  timestamp: number;
  statusConferencia?: string;
  justificativa?: string | null;
  logsVinculados: LogAlteracao[];
  raw: any;
}

interface AuditModalProps {
  visible: boolean;
  onClose: () => void;
  transacoes: Transacao[];
  fantasmas?: LembreteFantasma[];
  logs?: LogAlteracao[];
  totais?: TotaisTurno;
  caixaId?: string;
  operadorName?: string;
}

type FilterType = "todos" | "vendas" | "pix" | "vales" | "alteracoes" | "divergencias";

export function AuditModal({
  visible,
  onClose,
  transacoes = [],
  fantasmas = [],
  logs = [],
  totais,
  caixaId = "01",
  operadorName = "Operador"
}: AuditModalProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(style);
    }
  };

  const toggleExpand = (id: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. Compilação e Enriquecimento Forense dos Eventos
  const allEvents = useMemo<AuditEventItem[]>(() => {
    const list: AuditEventItem[] = [];

    // A) Transações (Vendas, Entradas, Sangrias, etc)
    (transacoes || []).forEach((t) => {
      const isSangria = t.categoria === "sangria";
      const isCancel = t.categoria === "cancelamento";
      const isPrestacao = t.categoria === "entrada_prestacao";
      const isCompraVista = t.categoria === "compra_vista";
      const isGar = t.categoria === "gar";
      const isMultiplo = t.categoria === "multiplo";
      
      let tipoFluxo: "entrada" | "saida" | "neutro" = "entrada";
      let actionCode = "VENDA_DINHEIRO";
      let titulo = "Venda Dinheiro";

      if (isSangria) {
        tipoFluxo = "saida";
        actionCode = "SANGRIA_GAVETA";
        titulo = "Sangria de Caixa";
      } else if (isCancel) {
        tipoFluxo = "saida";
        actionCode = "CANCELAMENTO_VENDA";
        titulo = "Cancelamento / Estorno";
      } else if (isPrestacao) {
        actionCode = "ENTRADA_PRESTACAO";
        titulo = "Entrada de Prestação";
      } else if (isCompraVista) {
        actionCode = "COMPRA_A_VISTA";
        titulo = "Compra à Vista";
      } else if (isGar) {
        actionCode = "GAR_GARANTIA";
        titulo = "Garantia / GAR";
      } else if (isMultiplo) {
        actionCode = "PAGAMENTO_MULTIPLO";
        titulo = "Pagamento Múltiplo";
      }

      // Verificação de valor físico vs sistema
      const temFisico = t.valorRecebidoFisico !== undefined && t.valorRecebidoFisico > 0;
      const diferenca = temFisico ? t.valorRecebidoFisico - t.valorSistema : 0;

      // Logs de auditoria vinculados
      const logsDestaTransacao = (logs || []).filter((l) => l.transacaoId === t.id);

      list.push({
        id: `t_${t.id}`,
        dbId: t.id,
        actionCode,
        type: "transacao",
        categoria: t.categoria || "dinheiro",
        naturezaOperacao: t.naturezaOperacao || "entrada",
        titulo,
        descricao: t.descricao || (isSangria ? "Retirada para cofre" : "Lançamento em espécie"),
        codigoContrato: t.codigoContrato,
        valorSistema: t.valorSistema || 0,
        valorRecebidoFisico: temFisico ? t.valorRecebidoFisico : undefined,
        diferencaFisica: Math.abs(diferenca) > 0.0001 ? diferenca : undefined,
        tipoFluxo,
        timestamp: t.timestamp || Date.now(),
        statusConferencia: t.statusConferencia || "confirmada",
        justificativa: t.justificativaTexto,
        logsVinculados: logsDestaTransacao,
        raw: t
      });
    });

    // B) Fantasmas (Vales, Empréstimos, PIX)
    (fantasmas || []).forEach((f) => {
      const isEmprestimo = f.tipo === "dinheiro_emprestado";
      const isDestroca = f.tipo === "destroca_pix_por_nota";
      const isPixRecebido = f.tipo === "pix_recebido_gaveta_saiu";

      let actionCode = "PENDENCIA_GERAL";
      let titulo = "Pendência de Caixa";
      let tipoFluxo: "entrada" | "saida" | "neutro" = "saida";

      if (isEmprestimo) {
        actionCode = "VALE_EMPRESTIMO";
        titulo = "Empréstimo / Vale";
        tipoFluxo = "saida";
      } else if (isDestroca) {
        actionCode = "DESTROCA_PIX";
        titulo = "Destroca PIX por Nota";
        tipoFluxo = "neutro";
      } else if (isPixRecebido) {
        actionCode = "PIX_GAVETA_SAIU";
        titulo = "PIX Recebido (Gaveta Saiu)";
        tipoFluxo = "saida";
      }

      list.push({
        id: `f_${f.id}`,
        dbId: f.id,
        actionCode,
        type: "fantasma",
        categoria: f.tipo || "fantasma",
        naturezaOperacao: "pendencia_temporaria",
        titulo,
        descricao: f.descricao || (f.pessoa ? `Responsável: ${f.pessoa}` : "Sem descrição"),
        pessoa: f.pessoa,
        valorSistema: f.valorReferencia || 0,
        tipoFluxo,
        timestamp: f.timestamp || Date.now(),
        statusConferencia: f.resolvido ? "resolvido" : "pendente",
        logsVinculados: [],
        raw: f
      });
    });

    // Ordenação cronológica decrescente (mais recentes no topo)
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [transacoes, fantasmas, logs]);

  // 2. Estatísticas Forenses Consolidadas
  const metrics = useMemo(() => {
    const totalSistema = totais?.sistema !== undefined && totais.sistema > 0 
      ? totais.sistema 
      : (transacoes || []).reduce((acc, t) => t.categoria !== "sangria" && t.categoria !== "cancelamento" ? acc + (t.valorSistema || 0) : acc, 0);

    const dinheiroSaco = totais?.especieEnvelope !== undefined && totais.especieEnvelope > 0
      ? totais.especieEnvelope
      : (totais?.gavetaFisico || 0);

    const pixRepasse = totais?.pixRepasse || 0;
    const sobraFalta = totais?.sobra !== undefined ? totais.sobra : 0;

    let divergenciasCount = 0;
    let somaDiferencasCentavos = 0;

    allEvents.forEach((ev) => {
      if (ev.diferencaFisica && Math.abs(ev.diferencaFisica) > 0.001) {
        divergenciasCount++;
        somaDiferencasCentavos += ev.diferencaFisica;
      }
      if (ev.statusConferencia === "incorreto") divergenciasCount++;
    });

    return {
      totalSistema,
      dinheiroSaco,
      pixRepasse,
      sobraFalta,
      divergenciasCount,
      somaDiferencasCentavos,
      alteracoesCount: (logs || []).length,
      totalEventos: allEvents.length
    };
  }, [allEvents, transacoes, logs, totais]);

  // 3. Filtragem
  const filteredEvents = useMemo(() => {
    return allEvents.filter((item) => {
      if (activeFilter === "vendas" && (item.type !== "transacao" || item.tipoFluxo !== "entrada")) return false;
      if (activeFilter === "pix" && item.categoria !== "pix_recebido_gaveta_saiu" && item.categoria !== "destroca_pix_por_nota") return false;
      if (activeFilter === "vales" && item.type !== "fantasma") return false;
      if (activeFilter === "alteracoes" && item.logsVinculados.length === 0) return false;
      if (activeFilter === "divergencias") {
        const hasDif = item.diferencaFisica && Math.abs(item.diferencaFisica) > 0.001;
        const isInc = item.statusConferencia === "incorreto";
        if (!hasDif && !isInc) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitulo = item.titulo.toLowerCase().includes(q);
        const matchDesc = item.descricao.toLowerCase().includes(q);
        const matchPessoa = item.pessoa?.toLowerCase().includes(q) || false;
        const matchCode = item.actionCode.toLowerCase().includes(q);
        const matchValor = toBrl(item.valorSistema).toLowerCase().includes(q);
        if (!matchTitulo && !matchDesc && !matchPessoa && !matchCode && !matchValor) return false;
      }

      return true;
    });
  }, [allEvents, activeFilter, searchQuery]);

  // 4. Copiar Relatório Forense
  const handleCopyReport = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const lines = [
      `========================================`,
      `🔍 LOGS DE AUDITORIA FORENSE - CAIXA ${caixaId}`,
      `👤 Operador Ativo: ${operadorName.toUpperCase()}`,
      `📅 Timestamp: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
      `========================================`,
      `💵 Vendas no Sistema: ${toBrl(metrics.totalSistema)}`,
      `📦 Dinheiro no Envelope: ${toBrl(metrics.dinheiroSaco)}`,
      `⚡ Pix a Transferir: ${toBrl(metrics.pixRepasse)}`,
      `⚖️ Sobra Apurada: ${metrics.sobraFalta >= 0 ? `+${toBrl(metrics.sobraFalta)}` : toBrl(metrics.sobraFalta)}`,
      `⚠️ Divergências / Arredondamentos: ${metrics.divergenciasCount}`,
      `📝 Alterações Realizadas: ${metrics.alteracoesCount}`,
      `========================================`,
      `📋 TRILHA DE EVENTOS (${filteredEvents.length} registros):`
    ];

    filteredEvents.forEach((ev, idx) => {
      const hora = new Date(ev.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const sinal = ev.tipoFluxo === "entrada" ? "(+)" : ev.tipoFluxo === "saida" ? "(-)" : "(=)";
      
      let linha = `[${hora}] #${ev.actionCode} ${sinal} ${toBrl(ev.valorSistema)} | ${ev.descricao}`;
      if (ev.diferencaFisica) {
        linha += ` [Gaveta: ${toBrl(ev.valorRecebidoFisico || 0)} | Dif: ${ev.diferencaFisica >= 0 ? "+" : ""}${toBrl(ev.diferencaFisica)}]`;
      }
      lines.push(linha);

      if (ev.logsVinculados.length > 0) {
        ev.logsVinculados.forEach((l) => {
          lines.push(`   ↳ 📝 Modificado: ${l.campoAlterado} de ${l.valorAntigo} para ${l.valorNovo} (Motivo: "${l.motivo || 'N/A'}")`);
        });
      }
    });

    Clipboard.setString(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#070709" }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#070709" }} edges={["top", "bottom"]}>
          
          {/* HEADER ENTERPRISE COM LOGS AUDIT */}
          <View className="px-4 py-3 bg-[#0d0d12] border-b border-zinc-800 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
              <View className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} color="#818cf8" strokeWidth={2.4} />
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs font-black uppercase tracking-wider text-white truncate" numberOfLines={1}>
                    Auditoria Forense • CX {caixaId}
                  </Text>
                  <View className="px-1.5 py-0.5 rounded bg-emerald-500/20">
                    <Text className="text-[7.5px] font-mono font-black text-emerald-400">ATIVO</Text>
                  </View>
                </View>
                <Text className="text-[9.5px] font-bold font-mono text-zinc-400 uppercase tracking-wider truncate" numberOfLines={1}>
                  {metrics.totalEventos} Eventos Auditados • {operadorName}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2 flex-shrink-0">
              <Pressable
                onPress={handleCopyReport}
                hitSlop={6}
                className="h-8 px-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex-row items-center gap-1 active:bg-zinc-800"
              >
                {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} color="#a1a1aa" />}
                <Text className="text-[9px] font-black font-mono text-zinc-300 uppercase">
                  {copied ? "COPIADO" : "COPIAR"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                hitSlop={8}
                className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
              >
                <X size={15} color="#d4d4d8" />
              </Pressable>
            </View>
          </View>

          {/* 4 CARDS CONSOLIDADOS DO CAIXA (2X2 GRID EQUILIBRADO) */}
          <View className="p-3 bg-[#0d0d12] border-b border-zinc-900 gap-2">
            
            {/* Linha 1: Vendas Sistema + Dinheiro no Saco */}
            <View className="flex-row gap-2">
              
              {/* Card 1: Total Sistema */}
              <View className="flex-1 bg-[#121216] border border-zinc-800 rounded-2xl p-2.5">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Total Sistema</Text>
                  <Banknote size={12} color="#34d399" />
                </View>
                <Text className="text-sm font-black font-mono text-emerald-400" numberOfLines={1}>
                  {toBrl(metrics.totalSistema)}
                </Text>
              </View>

              {/* Card 2: Dinheiro Envelope / Físico */}
              <View className="flex-1 bg-[#121216] border border-zinc-800 rounded-2xl p-2.5">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Dinheiro no Saco</Text>
                  <Wallet size={12} color="#60a5fa" />
                </View>
                <Text className="text-sm font-black font-mono text-white" numberOfLines={1}>
                  {toBrl(metrics.dinheiroSaco)}
                </Text>
              </View>

            </View>

            {/* Linha 2: Pix Repasse + Sobra / Diferença */}
            <View className="flex-row gap-2">
              
              {/* Card 3: Pix Repasse */}
              <View className="flex-1 bg-[#121216] border border-zinc-800 rounded-2xl p-2.5">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Pix a Transferir</Text>
                  <QrCode size={12} color="#fbbf24" />
                </View>
                <Text className="text-sm font-black font-mono text-amber-400" numberOfLines={1}>
                  {toBrl(metrics.pixRepasse)}
                </Text>
              </View>

              {/* Card 4: Sobra / Falta */}
              <View className={`flex-1 rounded-2xl p-2.5 border ${
                metrics.sobraFalta < 0 
                  ? "bg-red-500/10 border-red-500/30" 
                  : metrics.sobraFalta > 0 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : "bg-[#121216] border-zinc-800"
              }`}>
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                    {metrics.sobraFalta < 0 ? "Falta no Caixa" : metrics.sobraFalta > 0 ? "Sobra no Caixa" : "Caixa Bateu"}
                  </Text>
                  {metrics.sobraFalta !== 0 ? (
                    <AlertTriangle size={12} color={metrics.sobraFalta < 0 ? "#f87171" : "#34d399"} />
                  ) : (
                    <CheckCircle2 size={12} color="#34d399" />
                  )}
                </View>
                <Text className={`text-sm font-black font-mono ${
                  metrics.sobraFalta < 0 
                    ? "text-red-400" 
                    : metrics.sobraFalta > 0 
                    ? "text-emerald-400" 
                    : "text-zinc-400"
                }`} numberOfLines={1}>
                  {metrics.sobraFalta >= 0 ? `+${toBrl(metrics.sobraFalta)}` : toBrl(metrics.sobraFalta)}
                </Text>
              </View>

            </View>

          </View>

          {/* BARRA DE BUSCA + FILTROS POR CHIP */}
          <View className="px-3 pt-2.5 pb-2 bg-[#070709] gap-2">
            
            {/* Input de Busca */}
            <View className="h-9 bg-[#121216] border border-zinc-800 rounded-xl px-2.5 flex-row items-center gap-2">
              <Search size={13} color="#71717a" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por cliente, tag (#AÇÃO), valor..."
                placeholderTextColor="#52525b"
                className="flex-1 text-xs text-white py-0"
              />
              {Boolean(searchQuery) && (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                  <X size={12} color="#71717a" />
                </Pressable>
              )}
            </View>

            {/* Chips de Filtro */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[
                { id: "todos", label: `Todos (${allEvents.length})` },
                { id: "vendas", label: "Vendas" },
                { id: "pix", label: "PIX" },
                { id: "vales", label: `Vales (${fantasmas.length})` },
                { id: "alteracoes", label: `Edições (${metrics.alteracoesCount})` },
                { id: "divergencias", label: `Divergências (${metrics.divergenciasCount})` },
              ]}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 6 }}
              renderItem={({ item }) => {
                const isSelected = activeFilter === item.id;
                return (
                  <Pressable
                    onPress={() => {
                      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                      setActiveFilter(item.id as FilterType);
                    }}
                    className={`px-2.5 py-1 rounded-lg border ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-500"
                        : "bg-[#121216] border-zinc-800 active:bg-zinc-800"
                    }`}
                  >
                    <Text
                      className={`text-[9.5px] font-black uppercase tracking-wider ${
                        isSelected ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {/* LISTAGEM FORENSE DOS EVENTOS DE AUDITORIA */}
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 36 }}
            ListEmptyComponent={() => (
              <View className="items-center justify-center py-14 gap-2">
                <View className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center">
                  <ShieldCheck size={22} color="#71717a" />
                </View>
                <Text className="text-xs font-black uppercase tracking-wider text-zinc-400 text-center">
                  Nenhum registro encontrado
                </Text>
                <Text className="text-[9.5px] text-zinc-600 text-center">
                  Ajuste os filtros ou o termo de busca acima.
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const isExpanded = Boolean(expandedIds[item.id]);
              const dateObj = new Date(item.timestamp);
              const timeStr = `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}:${String(dateObj.getSeconds()).padStart(2, "0")}`;

              let IconComponent = Zap;
              let iconColor = "#34d399";
              let badgeBg = "bg-emerald-500/15 border-emerald-500/30";
              let valueColor = "text-emerald-400";
              let tagColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

              if (item.tipoFluxo === "saida") {
                IconComponent = ArrowUpRight;
                iconColor = "#f87171";
                badgeBg = "bg-red-500/15 border-red-500/30";
                valueColor = "text-red-400";
                tagColor = "text-red-400 bg-red-500/10 border-red-500/20";
              } else if (item.type === "fantasma") {
                IconComponent = Ghost;
                iconColor = "#fbbf24";
                badgeBg = "bg-amber-500/15 border-amber-500/30";
                valueColor = "text-amber-400";
                tagColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
              }

              const hasDiferenca = item.diferencaFisica !== undefined && Math.abs(item.diferencaFisica) > 0.001;

              return (
                <Pressable
                  onPress={() => toggleExpand(item.id)}
                  className="bg-[#121216] border border-zinc-800/90 rounded-2xl p-3.5 gap-2.5 shadow-sm active:bg-[#15151c]"
                >
                  
                  {/* 1. HEADER DO EVENTO COM ACTION CODE DISCORD-STYLE */}
                  <View className="flex-row items-center justify-between pb-1.5 border-b border-zinc-800/60">
                    <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                      <View className={`px-2 py-0.5 rounded-md border ${tagColor}`}>
                        <Text className="text-[10.5px] font-mono font-black uppercase">
                          #{item.actionCode}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Clock size={11} color="#71717a" />
                        <Text className="text-[11px] font-mono text-zinc-400">{timeStr}</Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] font-mono text-zinc-500">ID: {item.dbId.substring(0, 7)}</Text>
                      {isExpanded ? <ChevronUp size={15} color="#71717a" /> : <ChevronDown size={15} color="#71717a" />}
                    </View>
                  </View>

                  {/* 2. LINHA PRINCIPAL: TÍTULO, CLIENTE E VALOR DO SISTEMA */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <View className={`h-8.5 w-8.5 rounded-xl border ${badgeBg} items-center justify-center flex-shrink-0`}>
                        <IconComponent size={15} color={iconColor} strokeWidth={2.4} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-black uppercase tracking-wider text-white truncate" numberOfLines={1}>
                          {item.titulo}
                        </Text>
                        <Text className="text-[11px] font-bold text-zinc-300 uppercase truncate mt-0.5" numberOfLines={1}>
                          {item.descricao}
                        </Text>
                      </View>
                    </View>

                    {/* VALOR FORMATADO */}
                    <View className="items-end flex-shrink-0">
                      <Text className="text-[9px] font-black uppercase text-zinc-500">Valor Sistema</Text>
                      <Text className={`text-sm font-black font-mono ${valueColor}`}>
                        {item.tipoFluxo === "saida" ? "-" : "+"} {toBrl(item.valorSistema)}
                      </Text>
                    </View>
                  </View>

                  {/* 3. CARD DE DIFERENCIAL DE GAVETA / ARREDONDAMENTO (COM ESPAÇAMENTO PERFEITO) */}
                  {hasDiferenca && (
                    <View className="bg-[#09090c] border border-amber-500/30 rounded-xl p-2.5 flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-2 flex-1 min-w-0">
                        <AlertTriangle size={14} color="#fbbf24" />
                        <View className="flex-1 min-w-0">
                          <Text className="text-[9.5px] font-black uppercase text-zinc-500">Valor Físico na Gaveta</Text>
                          <Text className="text-xs font-mono font-black text-amber-300">
                            {toBrl(item.valorRecebidoFisico || 0)}
                          </Text>
                        </View>
                      </View>

                      <View className="items-end flex-shrink-0">
                        <Text className="text-[9.5px] font-black uppercase text-zinc-500">Diferencial / Sobra</Text>
                        <View className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                          <Text className="text-[11px] font-mono font-black text-amber-300">
                            {item.diferencaFisica! > 0 ? `+${toBrl(item.diferencaFisica!)}` : toBrl(item.diferencaFisica!)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 4. HISTÓRICO DE ALTERAÇÕES ESPECÍFICAS DA TRANSAÇÃO */}
                  {item.logsVinculados.length > 0 && (
                    <View className="bg-[#09090c] border border-sky-500/30 rounded-xl p-2.5 gap-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Edit3 size={12} color="#38bdf8" />
                        <Text className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                          Histórico de Auditoria ({item.logsVinculados.length} edições)
                        </Text>
                      </View>

                      {item.logsVinculados.map((log, lIdx) => {
                        const logTime = new Date(log.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                        return (
                          <View key={log.id || lIdx} className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800 gap-1">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-[9.5px] font-black uppercase text-zinc-400">
                                Campo: <Text className="text-sky-300 font-mono">{log.campoAlterado}</Text>
                              </Text>
                              <Text className="text-[9px] font-mono text-zinc-500">{logTime}</Text>
                            </View>

                            <View className="flex-row items-center gap-2">
                              <View className="flex-1 bg-black/40 p-1 rounded">
                                <Text className="text-[8.5px] text-zinc-500 uppercase">Anterior</Text>
                                <Text className="text-[10.5px] font-mono text-zinc-400 line-through">
                                  {typeof log.valorAntigo === "number" ? toBrl(log.valorAntigo) : String(log.valorAntigo)}
                                </Text>
                              </View>
                              <ArrowRight size={11} color="#71717a" />
                              <View className="flex-1 bg-black/40 p-1 rounded">
                                <Text className="text-[8.5px] text-sky-400 uppercase">Atualizado</Text>
                                <Text className="text-[10.5px] font-mono font-bold text-sky-300">
                                  {typeof log.valorNovo === "number" ? toBrl(log.valorNovo) : String(log.valorNovo)}
                                </Text>
                              </View>
                            </View>

                            {Boolean(log.motivo) && (
                              <Text className="text-[9.5px] text-zinc-400 italic">
                                Motivo: "{log.motivo}"
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* 5. DOSSIÊ FORENSE EXPANSÍVEL (DISCORD INSPECT MODE COM TODOS OS METADADOS) */}
                  {isExpanded && (
                    <View className="bg-[#08080a] border border-zinc-800 rounded-xl p-3 gap-2.5 mt-1">
                      <View className="flex-row items-center justify-between pb-1 border-b border-zinc-800/80">
                        <View className="flex-row items-center gap-1.5">
                          <Terminal size={12} color="#a1a1aa" />
                          <Text className="text-[10px] font-mono font-black uppercase text-zinc-400">
                            Metadados Forenses do Registro
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <Text className="text-[9px] font-mono font-bold text-emerald-400 uppercase">SINCRONIZADO</Text>
                        </View>
                      </View>

                      <View className="grid grid-cols-2 gap-2 flex-row flex-wrap">
                        
                        {/* ID Completo */}
                        <View className="min-w-[140px] flex-1 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[9px] font-black uppercase text-zinc-500">ID da Transação (Hash)</Text>
                          <Text className="text-[10px] font-mono font-bold text-zinc-300 select-all" numberOfLines={1}>
                            {item.dbId}
                          </Text>
                        </View>

                        {/* Status Conferência */}
                        <View className="min-w-[140px] flex-1 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[9px] font-black uppercase text-zinc-500">Status Conferência</Text>
                          <Text className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                            {item.statusConferencia || "CONFIRMADA"}
                          </Text>
                        </View>

                        {/* Natureza Operação */}
                        <View className="min-w-[140px] flex-1 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[9px] font-black uppercase text-zinc-500">Natureza Contábil</Text>
                          <Text className="text-[10px] font-mono font-bold text-zinc-300 uppercase">
                            {item.naturezaOperacao || (item.tipoFluxo === "entrada" ? "ENTRADA" : "SAÍDA")}
                          </Text>
                        </View>

                        {/* Terminal */}
                        <View className="min-w-[140px] flex-1 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[9px] font-black uppercase text-zinc-500">Terminal & Operador</Text>
                          <Text className="text-[10px] font-mono font-bold text-zinc-300 uppercase">
                            CAIXA {caixaId} • {operadorName}
                          </Text>
                        </View>

                        {/* Timestamp Epoch */}
                        <View className="min-w-[140px] flex-1 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[9px] font-black uppercase text-zinc-500">Timestamp Unix</Text>
                          <Text className="text-[10px] font-mono font-bold text-zinc-400">
                            {item.timestamp}
                          </Text>
                        </View>

                        {/* Categoria Interna */}
                        <View className="min-w-[140px] flex-1 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[9px] font-black uppercase text-zinc-500">Categoria do Sistema</Text>
                          <Text className="text-[10px] font-mono font-bold text-indigo-300 uppercase">
                            {item.categoria}
                          </Text>
                        </View>

                      </View>

                      {Boolean(item.codigoContrato) && (
                        <View className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[8px] font-black uppercase text-zinc-500">Contrato / Matrícula</Text>
                          <Text className="text-[9.5px] font-mono font-bold text-indigo-300">
                            {item.codigoContrato}
                          </Text>
                        </View>
                      )}

                      {Boolean(item.justificativa) && (
                        <View className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                          <Text className="text-[8px] font-black uppercase text-zinc-500">Justificativa Registrada</Text>
                          <Text className="text-[9px] text-zinc-300 italic">
                            "{item.justificativa}"
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                </Pressable>
              );
            }}
          />

        </SafeAreaView>
      </View>
    </Modal>
  );
}
