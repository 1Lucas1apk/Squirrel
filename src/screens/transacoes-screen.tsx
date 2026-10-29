import React, { useMemo, useState, useRef, useCallback, useEffect, useDeferredValue, memo } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  FlatList,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
} from "react-native";
import {
  Layers,
  Link as LinkIcon,
  Plus,
  Calculator,
  Banknote,
  ArrowDownCircle,
  ShoppingCart,
  Split,
  ArrowUpRight,
  XCircle,
  Trash2,
  Edit3,
  History as HistoryIcon,
  Search,
  Coins,
  Smartphone,
  Tag,
  Check,
  ArrowDownLeft,
  X,
  Cloud,
  User,
  Users,
  AlertTriangle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { MoneyInput } from "../components/common/money-input";
import {
  CategoriaTransacao,
  LogAlteracao,
  NaturezaOperacao,
  TotaisTurno,
  Transacao,
} from "../types/domain";
import { toBrl } from "../utils/currency";

interface TransacoesScreenProps {
  transacoes: Transacao[];
  logs?: LogAlteracao[];
  totais?: TotaisTurno;
  onAdicionar: (input: {
    clientLocalId?: string;
    naturezaOperacao: NaturezaOperacao;
    categoria: CategoriaTransacao;
    descricao: string;
    codigoContrato?: string;
    valorSistema: number;
    valorRecebidoFisico: number;
    trocoSobra: number;
    justificativaTexto?: string | null;
    transacaoVinculadaId?: string;
    statusConferencia?: "pendente" | "confirmada" | "incorreto";
  }) => Promise<void>;
  onCriarFantasma?: (input: any) => Promise<void>;
  onExcluir: (id: string) => void;
  onEditar: (id: string, input: any) => Promise<void>;
  onConfirmar: (title: string, message: string, onConfirm: () => void) => void;
  isFechado?: boolean;
}

type FiltroContabil = "todos" | "entradas" | "sangria" | "estorno";

interface ParcelaMulti {
  id: string;
  valor: number;
  descricao: string;
  contrato: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function naturezaPorCategoria(categoria: CategoriaTransacao): NaturezaOperacao {
  return categoria === "entrada_prestacao" ? "entrada" : "pagamento";
}

const withTimeout = <T,>(promise: Promise<T>, ms: number = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
  ]);
};

const EMPTY_LOGS: LogAlteracao[] = [];

interface TransacaoCardProps {
  item: Transacao;
  refDescricao?: string | null;
  itemLogs: LogAlteracao[];
  isFechado?: boolean;
  onEditarClick: (item: Transacao) => void;
  onExcluirClick: (id: string) => void;
}

const TransacaoCard = memo(function TransacaoCard({
  item,
  refDescricao,
  itemLogs,
  isFechado,
  onEditarClick,
  onExcluirClick,
}: TransacaoCardProps) {
  const isSaidaItem = item.categoria === "sangria" || item.categoria === "cancelamento";
  const isMistoItem = item.categoria === "multiplo";
  const horaFormatada = new Date(item.timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let icon = Banknote;
  let iconColor = "#34d399";
  let iconBg = "bg-emerald-500/15";
  let iconBorder = "border-emerald-500/30";
  let catLabel = "Dinheiro";
  let catTextColor = "text-emerald-400";

  if (item.categoria === "entrada_prestacao") {
    icon = ArrowDownCircle;
    iconColor = "#60a5fa";
    iconBg = "bg-blue-500/15";
    iconBorder = "border-blue-500/30";
    catLabel = "Entrada";
    catTextColor = "text-blue-400";
  } else if (item.categoria === "multiplo") {
    icon = Split;
    iconColor = "#fb923c";
    iconBg = "bg-orange-500/15";
    iconBorder = "border-orange-500/30";
    catLabel = "Misto";
    catTextColor = "text-orange-400";
  } else if (item.categoria === "compra_vista") {
    icon = ShoppingCart;
    iconColor = "#f4f4f5";
    iconBg = "bg-zinc-800";
    iconBorder = "border-zinc-700";
    catLabel = "À Vista";
    catTextColor = "text-zinc-300";
  } else if (item.categoria === "sangria") {
    icon = ArrowUpRight;
    iconColor = "#f87171";
    iconBg = "bg-red-500/15";
    iconBorder = "border-red-500/30";
    catLabel = "Sangria";
    catTextColor = "text-red-400";
  } else if (item.categoria === "cancelamento") {
    icon = XCircle;
    iconColor = "#ef4444";
    iconBg = "bg-red-600/15";
    iconBorder = "border-red-600/30";
    catLabel = "Estorno";
    catTextColor = "text-red-400";
  }

  const IconComponent = icon;

  return (
    <View className="rounded-[28px] bg-[#121216] p-4 border border-zinc-800 mb-3 shadow-md">
      <View className="flex-row items-center justify-between">
        {/* Lado Esquerdo: Ícone 48x48 + Informações e Valor Hero */}
        <View className="flex-1 flex-row items-center gap-3.5 min-w-0">
          <View
            className={`h-12 w-12 items-center justify-center rounded-2xl ${iconBg} border ${iconBorder} flex-shrink-0`}
          >
            <IconComponent size={20} color={iconColor} strokeWidth={2.5} />
          </View>

          <View className="flex-1 min-w-0">
            {/* Linha 1: Hora • Categoria + Badges (Contrato, Editado, Nuvem) */}
            <View className="flex-row items-center gap-1.5 flex-wrap mb-1">
              <Text className={`text-[10px] font-black uppercase tracking-widest ${catTextColor}`}>
                {horaFormatada} • {catLabel}
              </Text>
              {item.codigoContrato ? (
                <View className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                  <Text className="text-[9px] font-mono font-bold text-zinc-300">
                    #{item.codigoContrato}
                  </Text>
                </View>
              ) : null}
              {itemLogs.length > 0 && (
                <View className="bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30 flex-row items-center gap-1">
                  <HistoryIcon size={8} color="#60a5fa" />
                  <Text className="text-[9px] font-bold text-blue-400">
                    Editado ({itemLogs.length})
                  </Text>
                </View>
              )}
              {item.pendingSync && (
                <View className="bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 flex-row items-center gap-1">
                  <Cloud size={8} color="#fbbf24" />
                  <Text className="text-[9px] font-bold text-amber-400">
                    Offline
                  </Text>
                </View>
              )}
            </View>

            {/* Linha 2: VALOR GIGANTE E DESTACADO (HERO) */}
            <Text
              numberOfLines={1}
              className={`text-xl font-black font-mono ${
                isSaidaItem
                  ? "text-red-400"
                  : isMistoItem
                  ? "text-orange-300"
                  : "text-white"
              }`}
            >
              {isSaidaItem ? `- ${toBrl(item.valorSistema)}` : toBrl(item.valorSistema)}
            </Text>

            {/* Linha 3: Descrição/Cliente + Sobra + Breakdown Misto */}
            <View className="flex-row items-center gap-2 mt-1 flex-wrap">
              {item.trocoSobra !== 0 && !isSaidaItem ? (
                <View
                  className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded border ${
                    item.trocoSobra > 0
                      ? "bg-emerald-500/15 border-emerald-500/30"
                      : "bg-red-500/15 border-red-500/30"
                  }`}
                >
                  <Coins
                    size={10}
                    color={item.trocoSobra > 0 ? "#34d399" : "#f87171"}
                  />
                  <Text
                    className={`text-[9.5px] font-black font-mono ${
                      item.trocoSobra > 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {item.trocoSobra > 0
                      ? `+${toBrl(item.trocoSobra).replace("R$", "").trim()} Sobra`
                      : `${toBrl(item.trocoSobra).replace("R$", "").trim()} Falta`}
                  </Text>
                </View>
              ) : null}

              {isMistoItem ? (
                <View className="flex-row items-center gap-1 bg-[#09090c] border border-zinc-800 rounded-lg px-2 py-0.5">
                  <Banknote size={10} color="#34d399" />
                  <Text className="text-[10px] font-black text-emerald-400 font-mono">
                    {toBrl(item.valorRecebidoFisico).replace("R$", "").trim()}
                  </Text>
                  <Text className="text-[9px] font-black text-zinc-600">+</Text>
                  <Smartphone size={10} color="#c084fc" />
                  <Text className="text-[10px] font-black text-purple-300 font-mono">
                    {toBrl(Math.max(0, item.valorSistema - item.valorRecebidoFisico))
                      .replace("R$", "")
                      .trim()}
                  </Text>
                </View>
              ) : null}

              {item.descricao ? (
                <Text
                  className="text-[11.5px] font-bold text-zinc-400 flex-1 min-w-0"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.descricao}
                </Text>
              ) : null}

              {refDescricao ? (
                <View className="flex-row items-center gap-1">
                  <LinkIcon size={10} color="#60a5fa" />
                  <Text className="text-[9.5px] font-bold text-blue-400" numberOfLines={1}>
                    Ref: {refDescricao}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Lado Direito: Botões de Ação */}
        {!isFechado && (
          <View className="flex-row items-center gap-2 ml-3 flex-shrink-0">
            <Pressable
              onPress={() => onEditarClick(item)}
              className="h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800"
              hitSlop={8}
            >
              <Edit3 size={15} color="#a1a1aa" />
            </Pressable>

            <Pressable
              onPress={() => onExcluirClick(item.id)}
              className="h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 active:bg-red-500/30"
              hitSlop={8}
            >
              <Trash2 size={15} color="#f87171" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Histórico de Alterações / Logs de Auditoria */}
      {itemLogs.length > 0 && (
        <View className="mt-3 pt-2.5 border-t border-zinc-800/60 gap-1">
          <Text className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
            Histórico de Alterações
          </Text>
          {itemLogs.map((log: LogAlteracao) => (
            <View key={log.id} className="flex-row items-center gap-1.5">
              <View className="h-1 w-1 rounded-full bg-blue-400" />
              <Text className="text-[10px] text-zinc-400 font-bold">
                Alterado de <Text className="text-zinc-500 line-through">{toBrl(log.valorAntigo)}</Text> para <Text className="text-blue-400 font-mono font-black">{toBrl(log.valorNovo)}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

function TransacoesScreenComponent({
  transacoes,
  logs,
  totais,
  onAdicionar,
  onCriarFantasma,
  onExcluir,
  onEditar,
  onConfirmar,
  isFechado,
}: TransacoesScreenProps) {
  const descricaoRef = useRef<TextInput>(null);

  // Estados do formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaTransacao>("dinheiro");
  const [subTipoEntrada, setSubTipoEntrada] = useState<string | null>(null);
  const [valorSistema, setValorSistema] = useState(0);
  const [valorEntregueSimples, setValorEntregueSimples] = useState(0);
  const [valorTrocoDevolvido, setValorTrocoDevolvido] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [codigoContrato, setCodigoContrato] = useState("");
  const [transacaoVinculadaId, setTransacaoVinculadaId] = useState("");
  const [mostrarTransacoesVinculo, setMostrarTransacoesVinculo] = useState(false);
  const [buscaVendaVinculo, setBuscaVendaVinculo] = useState("");

  // Modos Dinâmicos: Troco, Multi, Pix
  const [isTrocoOpen, setIsTrocoOpen] = useState(false);
  const [isMultiOpen, setIsMultiOpen] = useState(false);
  const [parcelas, setParcelas] = useState<ParcelaMulti[]>([
    { id: Math.random().toString(), valor: 0, descricao: "", contrato: "" },
    { id: Math.random().toString(), valor: 0, descricao: "", contrato: "" },
  ]);

  const [isPixAtivo, setIsPixAtivo] = useState(false);
  const [pixDestino, setPixDestino] = useState<"meu_pix" | "outros">("meu_pix");
  const [pixNomeOutro, setPixNomeOutro] = useState("");
  const [pixValorTransferido, setPixValorTransferido] = useState(0);

  // Busca e Filtros Contábeis
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const buscaHistoricoDeferida = useDeferredValue(buscaHistorico);
  const [filtroContabil, setFiltroContabil] = useState<FiltroContabil>("todos");

  // Feedback e Submissão
  const [erro, setErro] = useState<string | null>(null);
  const [preConfirmado, setPreConfirmado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  const isSaida = categoria === "sangria" || categoria === "cancelamento";

  // Total do sistema (com arredondamento rigoroso de precisão)
  const totalSistemaAtual = useMemo(() => {
    if (isMultiOpen) {
      return roundMoney(parcelas.reduce((acc, p) => acc + (p.valor || 0), 0));
    }
    return roundMoney(valorSistema);
  }, [isMultiOpen, parcelas, valorSistema]);

  // Atualização reativa de valor Pix quando valorSistema muda
  useEffect(() => {
    if (isPixAtivo && !isMultiOpen && pixValorTransferido === 0 && valorSistema > 0) {
      setPixValorTransferido(valorSistema);
    }
  }, [valorSistema, isPixAtivo, isMultiOpen]);

  // Cálculos contábeis da gaveta física e sobra com precisão decimal blindada
  const valorPixEfetivo = useMemo(() => {
    return isPixAtivo ? roundMoney(Math.min(totalSistemaAtual, pixValorTransferido)) : 0;
  }, [isPixAtivo, totalSistemaAtual, pixValorTransferido]);

  const isPixTotal100 = isPixAtivo && valorPixEfetivo >= totalSistemaAtual && totalSistemaAtual > 0;

  const valorFisicoEntregue = useMemo(() => {
    if (isTrocoOpen) {
      return roundMoney(valorEntregueSimples - valorTrocoDevolvido);
    }
    return roundMoney(valorEntregueSimples);
  }, [isTrocoOpen, valorEntregueSimples, valorTrocoDevolvido]);

  const trocoSobra = useMemo(() => {
    if (isSaida) return 0;
    return roundMoney(valorFisicoEntregue - totalSistemaAtual);
  }, [isSaida, valorFisicoEntregue, totalSistemaAtual]);

  // Filtros contábeis de listagem com busca deferida (0ms input lag)
  const listagemFiltrada = useMemo(() => {
    const termo = buscaHistoricoDeferida.toLowerCase().trim();
    const termoLimpo = termo.replace("#", "");
    const temBusca = termo.length > 0;

    return transacoes.filter((item) => {
      // Filtro Contábil
      if (filtroContabil === "entradas") {
        if (item.categoria === "sangria" || item.categoria === "cancelamento") return false;
      } else if (filtroContabil === "sangria") {
        if (item.categoria !== "sangria") return false;
      } else if (filtroContabil === "estorno") {
        if (item.categoria !== "cancelamento") return false;
      }

      // Filtro por Texto / Contrato / Valor
      if (temBusca) {
        const descMatch = (item.descricao || "").toLowerCase().includes(termo);
        const contratoMatch = (item.codigoContrato || "").toLowerCase().includes(termoLimpo);
        const valorStr = item.valorSistema.toString().replace(".", ",");
        const valorMatch = valorStr.includes(termo);
        return descMatch || contratoMatch || valorMatch;
      }

      return true;
    });
  }, [transacoes, filtroContabil, buscaHistoricoDeferida]);

  // Contagens para os botões de filtro em única passada O(N)
  const contagensFiltro = useMemo(() => {
    let entradas = 0;
    let sangria = 0;
    let estorno = 0;
    for (let i = 0; i < transacoes.length; i++) {
      const cat = transacoes[i].categoria;
      if (cat === "sangria") sangria++;
      else if (cat === "cancelamento") estorno++;
      else entradas++;
    }
    return { todos: transacoes.length, entradas, sangria, estorno };
  }, [transacoes]);

  // Proporção Dinheiro Físico vs Pix Repasse para o Top Dock
  const dockStats = useMemo(() => {
    const gaveta = roundMoney(totais?.gavetaFisico ?? 0);
    const pix = roundMoney(totais?.pixRepasse ?? 0);
    const sobra = roundMoney(totais?.sobra ?? 0);
    const totalCirculante = roundMoney(gaveta + pix);
    const pctGaveta =
      totalCirculante > 0 ? Math.min(100, Math.max(0, (gaveta / totalCirculante) * 100)) : 50;
    const pctPix = 100 - pctGaveta;
    return {
      gaveta,
      pix,
      sobra,
      pctGaveta: pctGaveta.toFixed(0),
      pctPix: pctPix.toFixed(0),
    };
  }, [totais]);

  function resetForm() {
    isSubmittingRef.current = false;
    setEditingId(null);
    setCategoria("dinheiro");
    setSubTipoEntrada(null);
    setValorSistema(0);
    setValorEntregueSimples(0);
    setValorTrocoDevolvido(0);
    setDescricao("");
    setCodigoContrato("");
    setTransacaoVinculadaId("");
    setIsTrocoOpen(false);
    setIsMultiOpen(false);
    setParcelas([
      { id: Math.random().toString(), valor: 0, descricao: "", contrato: "" },
      { id: Math.random().toString(), valor: 0, descricao: "", contrato: "" },
    ]);
    setIsPixAtivo(false);
    setPixDestino("meu_pix");
    setPixNomeOutro("");
    setPixValorTransferido(0);
    setMostrarTransacoesVinculo(false);
    setBuscaVendaVinculo("");
    setErro(null);
    setPreConfirmado(false);
    setIsSubmitting(false);
  }

  function showError(msg: string) {
    setErro(msg);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => setErro(null), 4000);
  }

  function formatarTexto(txt: string) {
    const t = txt.trim();
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function handleSelectCategory(cat: CategoriaTransacao) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategoria(cat);
    setPreConfirmado(false);

    if (cat !== "entrada_prestacao") {
      setSubTipoEntrada(null);
    }
  }

  function handleToggleTroco() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsTrocoOpen(!isTrocoOpen);
    if (!isTrocoOpen) setValorTrocoDevolvido(0);
  }

  function handleToggleMulti() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsMultiOpen(!isMultiOpen);
  }

  function handleTogglePix() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !isPixAtivo;
    setIsPixAtivo(next);
    if (next) {
      setPixValorTransferido(totalSistemaAtual);
    } else {
      setPixValorTransferido(0);
    }
  }

  function addMultiParcela() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setParcelas((prev) => [
      ...prev,
      { id: Math.random().toString(), valor: 0, descricao: "", contrato: "" },
    ]);
  }

  function removeMultiParcela(id: string) {
    if (parcelas.length <= 1) {
      showError("O modo Multi precisa ter pelo menos 1 parcela.");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setParcelas((prev) => prev.filter((p) => p.id !== id));
  }

  function updateMultiParcela(id: string, field: "valor" | "descricao" | "contrato", value: any) {
    setParcelas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  async function onSalvar() {
    const now = Date.now();
    // Trava síncrona anti-duplicação: bloqueia qualquer clique repetido em menos de 1,2s
    if (isSubmittingRef.current || (now - lastSubmitTimeRef.current < 1200)) {
      console.warn("[Transacoes] Bloqueado clique repetido/duplicado.");
      return;
    }

    if (totalSistemaAtual > 100000) {
      showError("Limite de 100 mil.");
      return;
    }

    // Alerta de Valor Atípico (> R$ 2.000,00)
    if (!preConfirmado && totalSistemaAtual > 2000) {
      onConfirmar(
        "VALOR ALTO DETECTADO",
        `Você está lançando ${toBrl(totalSistemaAtual)}. Tem certeza que este valor está correto?`,
        () => {
          setPreConfirmado(true);
          setTimeout(() => void onSalvar(), 200);
        }
      );
      return;
    }

    // Trava de Sobra/Falta Alta (>= R$ 1,00)
    if (!preConfirmado && !isSaida && Math.abs(trocoSobra) >= 1) {
      setPreConfirmado(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError(`Atenção: Diferença de ${toBrl(trocoSobra)}. Clique de novo para confirmar.`);
      return;
    }

    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;
    setIsSubmitting(true);

    try {
      const clientLocalId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      if (isMultiOpen) {
        const valid = parcelas.filter((p) => p.valor > 0);
        if (valid.length === 0) {
          showError("Informe ao menos um valor no Multi.");
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          return;
        }

        let sobraRestante = trocoSobra;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        for (let i = 0; i < valid.length; i++) {
          const p = valid[i];
          const sobraAplicada = i === 0 ? sobraRestante : 0;
          const gavetaAplicada = !isSaida ? roundMoney(p.valor + sobraAplicada) : 0;

          await onAdicionar({
            clientLocalId: `${clientLocalId}_p${i}`,
            naturezaOperacao: naturezaPorCategoria(categoria),
            categoria,
            descricao: formatarTexto(p.descricao) || `Pgto ${i + 1}`,
            codigoContrato: p.contrato.trim() || undefined,
            valorSistema: roundMoney(Math.abs(p.valor)),
            valorRecebidoFisico: roundMoney(Math.max(0, gavetaAplicada)),
            trocoSobra: roundMoney(sobraAplicada),
            transacaoVinculadaId: transacaoVinculadaId || undefined,
            statusConferencia: isPixAtivo ? "confirmada" : "pendente",
          });
        }

        // Se houver Pix no Multi, cria lembrete
        if (isPixAtivo && valorPixEfetivo > 0 && onCriarFantasma) {
          await onCriarFantasma({
            clientLocalId: `${clientLocalId}_ghost`,
            tipo: "pix_recebido_gaveta_saiu",
            pessoa: pixDestino === "meu_pix" ? "Meu Pix" : pixNomeOutro.trim() || "Outros",
            descricao: `Pix Carnês em Lote (${valid.length} parcelas)`,
            valorReferencia: valorPixEfetivo,
            impactaPixRepasse: true,
            destinoPix: pixDestino === "meu_pix" ? "Meu Pix" : pixNomeOutro.trim() || "Outros",
            resolvido: true,
            comprovadoPix: true,
          });
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetForm();
      } else {
        if (valorSistema <= 0) {
          showError("Informe o valor do sistema.");
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          return;
        }

        const gavetaAplicada = !isSaida ? roundMoney(valorFisicoEntregue) : 0;
        const payload = {
          clientLocalId,
          naturezaOperacao: naturezaPorCategoria(categoria),
          categoria,
          descricao: formatarTexto(descricao) || (categoria === "multiplo" ? "Lançamento Misto" : "Lançamento"),
          codigoContrato: codigoContrato.trim() || undefined,
          valorSistema: roundMoney(Math.abs(valorSistema)),
          valorRecebidoFisico: roundMoney(Math.max(0, gavetaAplicada)),
          trocoSobra: !isSaida ? roundMoney(trocoSobra) : 0,
          transacaoVinculadaId: transacaoVinculadaId || undefined,
          statusConferencia: isPixAtivo ? ("confirmada" as const) : ("pendente" as const),
        };

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (editingId) {
          await onEditar(editingId, payload);
        } else {
          await onAdicionar(payload);

          // Se houver Pix registrado nesta transação simples, cria o lembrete fantasma
          if (isPixAtivo && valorPixEfetivo > 0 && onCriarFantasma) {
            await onCriarFantasma({
              clientLocalId: `${clientLocalId}_ghost`,
              tipo: "pix_recebido_gaveta_saiu",
              pessoa: pixDestino === "meu_pix" ? "Meu Pix" : pixNomeOutro.trim() || "Outros",
              descricao: `Pix de ${formatarTexto(descricao) || "Cliente"} (${codigoContrato ? '#' + codigoContrato : 'Sem contrato'})`,
              valorReferencia: valorPixEfetivo,
              impactaPixRepasse: true,
              destinoPix: pixDestino === "meu_pix" ? "Meu Pix" : pixNomeOutro.trim() || "Outros",
              resolvido: true,
              comprovadoPix: true,
            });
          }
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetForm();
      }
    } catch (e: any) {
      showError(
        e?.message || "Erro ao salvar lançamento."
      );
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
      setIsSubmitting(false);
    }
  }

  // Estilos de tema dinâmico
  const theme = useMemo(() => {
    if (isPixAtivo) {
      return {
        border: "border-purple-500/50",
        text: "text-purple-400",
        bgBtn: "bg-purple-600",
        txtBtn: "text-white",
        label: isPixTotal100 
          ? "Registrar Recebimento via Pix" 
          : "Registrar Venda (Pix + Dinheiro)",
      };
    }

    switch (categoria) {
      case "entrada_prestacao":
        return {
          border: "border-blue-500/40",
          text: "text-blue-400",
          bgBtn: "bg-blue-500",
          txtBtn: "text-white",
          label: "Registrar Entrada",
        };
      case "multiplo":
        return {
          border: "border-orange-500/40",
          text: "text-orange-400",
          bgBtn: "bg-orange-500",
          txtBtn: "text-white",
          label: "Registrar Misto",
        };
      case "compra_vista":
        return {
          border: "border-zinc-400/40",
          text: "text-zinc-200",
          bgBtn: "bg-zinc-100",
          txtBtn: "text-zinc-950",
          label: "Registrar Venda à Vista",
        };
      case "sangria":
        return {
          border: "border-red-500/40",
          text: "text-red-400",
          bgBtn: "bg-red-500",
          txtBtn: "text-white",
          label: "Confirmar Retirada",
        };
      case "cancelamento":
        return {
          border: "border-red-600/40",
          text: "text-red-400",
          bgBtn: "bg-red-600",
          txtBtn: "text-white",
          label: "Confirmar Estorno",
        };
      case "dinheiro":
      default:
        return {
          border: "border-emerald-500/40",
          text: "text-emerald-400",
          bgBtn: "bg-emerald-500",
          txtBtn: "text-zinc-950",
          label: "Registrar em Dinheiro",
        };
    }
  }, [categoria, isPixAtivo, isPixTotal100]);

  // Pré-indexação O(1) para auditoria e vínculos (elimina loops O(N²) em cada frame/scroll)
  const logsByTxId = useMemo(() => {
    const map = new Map<string, LogAlteracao[]>();
    if (logs) {
      for (const log of logs) {
        if (!log.transacaoId) continue;
        const list = map.get(log.transacaoId) || [];
        list.push(log);
        map.set(log.transacaoId, list);
      }
    }
    return map;
  }, [logs]);

  const txById = useMemo(() => {
    const map = new Map<string, Transacao>();
    for (const t of transacoes) {
      map.set(t.id, t);
    }
    return map;
  }, [transacoes]);

  const handleEditarClick = useCallback((item: Transacao) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(item.id);
    setCategoria(item.categoria);
    setValorSistema(item.valorSistema);
    setDescricao(item.descricao);
    setCodigoContrato(item.codigoContrato || "");
    setTransacaoVinculadaId(item.transacaoVinculadaId || "");
    setValorEntregueSimples(item.valorRecebidoFisico);
    setIsMultiOpen(false);
    setIsPixAtivo(false);
  }, []);

  const handleExcluirClick = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onExcluir(id);
  }, [onExcluir]);

  // Render do Card de Histórico usando componente memorizado (0ms lag ao digitar no formulário)
  const renderItem = useCallback(
    ({ item }: { item: Transacao }) => {
      const itemLogs = logsByTxId.get(item.id) || EMPTY_LOGS;
      const refDescricao = item.transacaoVinculadaId
        ? txById.get(item.transacaoVinculadaId)?.descricao || "Lançamento"
        : null;

      return (
        <TransacaoCard
          item={item}
          refDescricao={refDescricao}
          itemLogs={itemLogs}
          isFechado={isFechado}
          onEditarClick={handleEditarClick}
          onExcluirClick={handleExcluirClick}
        />
      );
    },
    [logsByTxId, txById, isFechado, handleEditarClick, handleExcluirClick]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <FlatList
        className="flex-1"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        data={listagemFiltrada}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListHeaderComponent={
          <View className="gap-3 mb-3">
            {/* 1. DOCK SUPERIOR ULTRA SIMPLES & COMPACTO (ZERO OVERLAP) */}
            <View className="bg-[#121216] border border-zinc-800/90 rounded-2xl p-2.5 px-3.5 shadow-sm gap-1.5">
              <View className="flex-row items-center justify-between">
                {/* Lado Esquerdo: Dinheiro na Gaveta */}
                <View className="flex-row items-center gap-1.5 flex-shrink-0">
                  <Banknote size={14} color="#34d399" />
                  <Text className="text-xs font-black text-emerald-400 font-mono">
                    {toBrl(dockStats.gaveta)}
                  </Text>
                </View>

                {/* Centro: Sobra Acumulada */}
                <View className="flex-row items-center gap-1 bg-[#09090c] border border-zinc-800/80 px-2 py-0.5 rounded-full flex-shrink-0">
                  <Coins size={10} color={dockStats.sobra >= 0 ? "#34d399" : "#f87171"} />
                  <Text
                    className={`text-[10px] font-black font-mono ${
                      dockStats.sobra >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {dockStats.sobra >= 0 ? `+${toBrl(dockStats.sobra)}` : toBrl(dockStats.sobra)}
                  </Text>
                </View>

                {/* Lado Direito: Pix Repasse */}
                <View className="flex-row items-center gap-1.5 flex-shrink-0">
                  <Smartphone size={14} color="#818cf8" />
                  <Text className="text-xs font-black text-indigo-300 font-mono">
                    {toBrl(dockStats.pix)}
                  </Text>
                </View>
              </View>

              {/* Micro Barra de Proporção Slim (1.5px) */}
              <View className="h-1 w-full bg-[#09090c] rounded-full flex-row overflow-hidden border border-zinc-800/60">
                <View
                  style={{ width: `${dockStats.pctGaveta}%` as any }}
                  className="bg-emerald-400 rounded-full"
                />
                <View
                  style={{ width: `${dockStats.pctPix}%` as any }}
                  className="bg-indigo-400 rounded-full"
                />
              </View>
            </View>

            {/* 2. FORMULÁRIO PRINCIPAL DE TRANSAÇÃO (PROPORCIONAL & HARMONIOSO) */}
            {!isFechado && (
              <View
                className={`bg-[#121216] border ${theme.border} rounded-[32px] p-3.5 shadow-2xl gap-3`}
              >
                {/* Topo do Card: Título + Botões Troco e Multi */}
                <View className="flex-row items-center justify-between pb-1 border-b border-zinc-800/80">
                  <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                    <View
                      className={`h-6 w-6 rounded-lg items-center justify-center flex-shrink-0 ${
                        editingId
                          ? "bg-blue-500/20 border border-blue-500/40"
                          : "bg-emerald-500/20 border border-emerald-500/40"
                      }`}
                    >
                      {editingId ? (
                        <Edit3 size={13} color="#60a5fa" />
                      ) : (
                        <Plus size={14} color="#34d399" strokeWidth={3} />
                      )}
                    </View>
                    <Text
                      className={`text-xs font-black uppercase tracking-[1.5px] ${
                        editingId ? "text-blue-300" : "text-zinc-200"
                      }`}
                    >
                      {editingId ? "Editar Lançamento" : "Novo Lançamento"}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1.5 flex-shrink-0">
                    <Pressable
                      onPress={handleToggleTroco}
                      className={`px-2.5 py-1 rounded-xl border flex-row items-center gap-1 active:scale-95 ${
                        isTrocoOpen
                          ? "bg-emerald-500/15 border-emerald-500/30"
                          : "bg-[#09090c] border-zinc-800"
                      }`}
                    >
                      <Calculator
                        size={12}
                        color={isTrocoOpen ? "#34d399" : "#a1a1aa"}
                      />
                      <Text
                        className={`text-[11px] font-black uppercase ${
                          isTrocoOpen ? "text-emerald-300" : "text-zinc-300"
                        }`}
                      >
                        Troco
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleToggleMulti}
                      className={`px-2.5 py-1 rounded-xl border flex-row items-center gap-1 active:scale-95 ${
                        isMultiOpen
                          ? "bg-amber-500/15 border-amber-500/30"
                          : "bg-[#09090c] border-zinc-800"
                      }`}
                    >
                      <Layers
                        size={12}
                        color={isMultiOpen ? "#fbbf24" : "#a1a1aa"}
                      />
                      <Text
                        className={`text-[11px] font-black uppercase ${
                          isMultiOpen ? "text-amber-300" : "text-zinc-300"
                        }`}
                      >
                        Multi
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* SELETOR DE CATEGORIAS: PROPORCIONAL & ELEGANTE */}
                <View className="gap-2">
                  {/* Linha 1: Principais (Dinheiro, Entrada, Misto) */}
                  <View className="flex-row gap-2">
                    {/* Dinheiro */}
                    <Pressable
                      onPress={() => handleSelectCategory("dinheiro")}
                      className={`flex-1 py-2.5 px-1 rounded-2xl border items-center justify-center gap-1 bg-[#09090c] min-h-[72px] ${
                        categoria === "dinheiro"
                          ? "border-emerald-500/50 shadow-sm"
                          : "border-zinc-800"
                      }`}
                    >
                      <View
                        className={`h-8 w-8 rounded-xl items-center justify-center ${
                          categoria === "dinheiro"
                            ? "bg-emerald-500/20 border border-emerald-500/40"
                            : "bg-zinc-900 border border-zinc-800"
                        }`}
                      >
                        <Banknote
                          size={18}
                          color={categoria === "dinheiro" ? "#34d399" : "#a1a1aa"}
                        />
                      </View>
                      <Text
                        className={`text-[11px] font-black uppercase tracking-wider ${
                          categoria === "dinheiro" ? "text-emerald-400" : "text-zinc-400"
                        }`}
                      >
                        Dinheiro
                      </Text>
                    </Pressable>

                    {/* Entrada (Antiga Prestação) */}
                    <Pressable
                      onPress={() => handleSelectCategory("entrada_prestacao")}
                      className={`flex-1 py-2.5 px-1 rounded-2xl border items-center justify-center gap-1 bg-[#09090c] min-h-[72px] ${
                        categoria === "entrada_prestacao"
                          ? "border-blue-500/50 shadow-sm"
                          : "border-zinc-800"
                      }`}
                    >
                      <View
                        className={`h-8 w-8 rounded-xl items-center justify-center ${
                          categoria === "entrada_prestacao"
                            ? "bg-blue-500/20 border border-blue-500/40"
                            : "bg-zinc-900 border border-zinc-800"
                        }`}
                      >
                        <ArrowDownCircle
                          size={18}
                          color={
                            categoria === "entrada_prestacao" ? "#60a5fa" : "#a1a1aa"
                          }
                        />
                      </View>
                      <Text
                        className={`text-[11px] font-black uppercase tracking-wider ${
                          categoria === "entrada_prestacao"
                            ? "text-blue-400"
                            : "text-zinc-400"
                        }`}
                      >
                        Entrada
                      </Text>
                    </Pressable>

                    {/* Misto */}
                    <Pressable
                      onPress={() => handleSelectCategory("multiplo")}
                      className={`flex-1 py-2.5 px-1 rounded-2xl border items-center justify-center gap-1 bg-[#09090c] min-h-[72px] ${
                        categoria === "multiplo"
                          ? "border-orange-500/50 shadow-sm"
                          : "border-zinc-800"
                      }`}
                    >
                      <View
                        className={`h-8 w-8 rounded-xl items-center justify-center ${
                          categoria === "multiplo"
                            ? "bg-orange-500/20 border border-orange-500/40"
                            : "bg-zinc-900 border border-zinc-800"
                        }`}
                      >
                        <Split
                          size={18}
                          color={categoria === "multiplo" ? "#fb923c" : "#a1a1aa"}
                        />
                      </View>
                      <Text
                        className={`text-[11px] font-black uppercase tracking-wider ${
                          categoria === "multiplo" ? "text-orange-400" : "text-zinc-400"
                        }`}
                      >
                        Misto
                      </Text>
                    </Pressable>
                  </View>

                  {/* Linha 2: Secundárias */}
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleSelectCategory("compra_vista")}
                      className={`flex-1 py-2 px-1 rounded-xl border flex-row items-center justify-center gap-1.5 bg-[#09090c] min-h-[40px] ${
                        categoria === "compra_vista"
                          ? "border-zinc-400/50"
                          : "border-zinc-800"
                      }`}
                    >
                      <ShoppingCart
                        size={13}
                        color={categoria === "compra_vista" ? "#f4f4f5" : "#a1a1aa"}
                      />
                      <Text
                        className={`text-[10.5px] font-black uppercase tracking-wider ${
                          categoria === "compra_vista" ? "text-zinc-200" : "text-zinc-400"
                        }`}
                      >
                        À Vista
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleSelectCategory("sangria")}
                      className={`flex-1 py-2 px-1 rounded-xl border flex-row items-center justify-center gap-1.5 bg-[#09090c] min-h-[40px] ${
                        categoria === "sangria"
                          ? "border-red-500/50"
                          : "border-zinc-800"
                      }`}
                    >
                      <ArrowUpRight
                        size={14}
                        color={categoria === "sangria" ? "#f87171" : "#a1a1aa"}
                      />
                      <Text
                        className={`text-[10.5px] font-black uppercase tracking-wider ${
                          categoria === "sangria" ? "text-red-400" : "text-zinc-400"
                        }`}
                      >
                        Sangria
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleSelectCategory("cancelamento")}
                      className={`flex-1 py-2 px-1 rounded-xl border flex-row items-center justify-center gap-1.5 bg-[#09090c] min-h-[40px] ${
                        categoria === "cancelamento"
                          ? "border-red-600/50"
                          : "border-zinc-800"
                      }`}
                    >
                      <XCircle
                        size={14}
                        color={categoria === "cancelamento" ? "#ef4444" : "#a1a1aa"}
                      />
                      <Text
                        className={`text-[10.5px] font-black uppercase tracking-wider ${
                          categoria === "cancelamento" ? "text-red-400" : "text-zinc-400"
                        }`}
                      >
                        Estorno
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* SUB-TIPOS DE ENTRADA (SEGMENT CONTROL) */}
                {categoria === "entrada_prestacao" && (
                  <View className="bg-[#090d16] p-3 rounded-2xl border border-blue-500/30 gap-2">
                    <View className="flex-row items-center gap-1.5 px-1">
                      <Tag size={13} color="#60a5fa" />
                      <Text className="text-xs font-black uppercase tracking-[1.5px] text-blue-400">
                        Tipo de Entrada
                      </Text>
                    </View>
                    <View className="flex-row gap-1.5 bg-[#05070c] p-1.5 rounded-xl border border-blue-500/20">
                      {["Renegociação", "Quitação", "Entrada (Compra)"].map((sub) => {
                        const active = subTipoEntrada === sub;
                        return (
                          <Pressable
                            key={sub}
                            onPress={() => {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setSubTipoEntrada(sub);
                              setDescricao(`${sub} / `);
                            }}
                            className={`flex-1 py-2 px-1 rounded-lg items-center justify-center ${
                              active ? "bg-blue-500 shadow-sm" : "bg-transparent"
                            }`}
                          >
                            <Text
                              className={`text-[10.5px] font-black uppercase text-center ${
                                active ? "text-white" : "text-zinc-400"
                              }`}
                            >
                              {sub === "Entrada (Compra)" ? "Entrada Compra" : sub}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* BOTÃO DE PIX DINÂMICO */}
                {!isSaida && (
                  <View
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isPixAtivo
                        ? "bg-[#120e1e] border-purple-500/50 shadow-lg"
                        : "bg-[#09090c] border-zinc-800"
                    }`}
                  >
                    {/* Barra Superior Clicável */}
                    <Pressable
                      onPress={handleTogglePix}
                      className="p-3.5 px-4 flex-row items-center justify-between min-h-[54px]"
                    >
                      <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                        <View
                          className={`w-5 h-5 rounded-full border-2 items-center justify-center flex-shrink-0 ${
                            isPixAtivo
                              ? "border-purple-400 bg-purple-950"
                              : "border-zinc-700 bg-[#121216]"
                          }`}
                        >
                          <View
                            className={`w-2.5 h-2.5 rounded-full ${
                              isPixAtivo ? "bg-purple-400" : "bg-transparent"
                            }`}
                          />
                        </View>

                        <View
                          className={`h-6 w-6 rounded-lg items-center justify-center flex-shrink-0 ${
                            isPixAtivo
                              ? "bg-purple-500/20 border border-purple-500/40"
                              : "bg-zinc-900 border border-zinc-800"
                          }`}
                        >
                          <Smartphone
                            size={14}
                            color={isPixAtivo ? "#d8b4fe" : "#a1a1aa"}
                          />
                        </View>

                        <Text
                          className={`text-xs font-black uppercase tracking-wider ${
                            isPixAtivo ? "text-purple-200" : "text-zinc-200"
                          }`}
                        >
                          Recebido via Pix
                        </Text>
                      </View>

                      {isPixAtivo && (
                        <View className="px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/40 flex-shrink-0">
                          <Text className="text-[10px] font-mono font-black text-purple-300 uppercase">
                            {isPixTotal100
                              ? "Pix 100%"
                              : `Pix Parcial (${toBrl(valorPixEfetivo).replace("R$", "").trim()})`}
                          </Text>
                        </View>
                      )}
                    </Pressable>

                    {/* Corpo Expandido do Pix */}
                    {isPixAtivo && (
                      <View className="p-3.5 pt-1 gap-3 border-t border-purple-500/20">
                        {/* Linha 1: QUEM RECEBEU O PIX */}
                        <View className="gap-1.5 pt-1">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs font-black uppercase text-purple-300 tracking-wider">
                              QUEM:
                            </Text>
                            <View className="flex-row gap-1 bg-[#09090c] p-1 rounded-xl border border-purple-500/30">
                              <Pressable
                                onPress={() => {
                                  setPixDestino("meu_pix");
                                  setPixNomeOutro("");
                                }}
                                className={`px-3 py-1.5 rounded-lg flex-row items-center gap-1.5 ${
                                  pixDestino === "meu_pix"
                                    ? "bg-purple-500/30 border border-purple-500/50"
                                    : "bg-transparent"
                                }`}
                              >
                                <View
                                  className={`w-2 h-2 rounded-full ${
                                    pixDestino === "meu_pix" ? "bg-purple-300" : "bg-zinc-600"
                                  }`}
                                />
                                <Text
                                  className={`text-xs font-black uppercase ${
                                    pixDestino === "meu_pix" ? "text-purple-200" : "text-zinc-400"
                                  }`}
                                >
                                  Eu
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() => {
                                  setPixDestino("outros");
                                }}
                                className={`px-3 py-1.5 rounded-lg flex-row items-center gap-1.5 ${
                                  pixDestino === "outros"
                                    ? "bg-purple-500/30 border border-purple-500/50"
                                    : "bg-transparent"
                                }`}
                              >
                                <View
                                  className={`w-2 h-2 rounded-full ${
                                    pixDestino === "outros" ? "bg-purple-300" : "bg-zinc-600"
                                  }`}
                                />
                                <Text
                                  className={`text-xs font-black uppercase ${
                                    pixDestino === "outros" ? "text-purple-200" : "text-zinc-400"
                                  }`}
                                >
                                  Outro
                                </Text>
                              </Pressable>
                            </View>
                          </View>

                          {/* Campo QUEM (Nome do Titular do Pix quando Outro) */}
                          {pixDestino === "outros" && (
                            <View className="bg-[#09090c] p-3 px-3.5 rounded-xl border border-purple-500/40 gap-1">
                              <Text className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                                Nome de quem recebeu o Pix:
                              </Text>
                              <TextInput
                                value={pixNomeOutro}
                                onChangeText={setPixNomeOutro}
                                placeholder="Digite o nome (ex: Vendedor, Gerente...)"
                                placeholderTextColor="#52525b"
                                style={{ paddingVertical: 0, paddingHorizontal: 0, includeFontPadding: false }}
                                className="text-sm font-bold text-white"
                              />
                            </View>
                          )}
                        </View>

                        {/* Linha 2: Valor Transferido no Pix */}
                        <View className="bg-[#09090c] p-3 px-3.5 rounded-2xl border border-purple-500/30 gap-2">
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-1.5">
                              <Coins size={14} color="#c084fc" />
                              <Text className="text-xs font-black uppercase text-purple-300 tracking-wider">
                                Valor no Pix
                              </Text>
                            </View>

                            <Pressable
                              onPress={() => {
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setPixValorTransferido(totalSistemaAtual);
                                setPreConfirmado(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 active:scale-95"
                            >
                              <Text className="text-[10px] font-black uppercase text-purple-200">
                                Preencher 100%
                              </Text>
                            </Pressable>
                          </View>

                          <View className="flex-row items-center min-w-0">
                            <Text className="text-purple-400 text-sm font-bold mr-1.5 flex-shrink-0">R$</Text>
                            <MoneyInput
                              value={pixValorTransferido}
                              onChangeValue={(v) => {
                                setPixValorTransferido(v);
                                setPreConfirmado(false);
                              }}
                              className="flex-1 min-w-0 text-xl font-black text-purple-200 font-mono tracking-tight"
                              placeholder="0,00"
                              placeholderTextColor="#52525b"
                            />
                          </View>
                        </View>

                        {/* Linha 3: Aviso de Restante na Gaveta (quando Pix Parcial) */}
                        {valorPixEfetivo < totalSistemaAtual && valorPixEfetivo > 0 && (
                          <View className="p-2.5 rounded-xl flex-row items-center gap-2 bg-emerald-500/10 border border-emerald-500/25">
                            <View className="h-6 w-6 rounded-lg items-center justify-center flex-shrink-0 bg-emerald-500/20">
                              <Banknote size={13} color="#34d399" />
                            </View>
                            <Text className="text-xs font-bold flex-1 leading-tight text-emerald-300">
                              {`Restante de ${toBrl(Math.max(0, totalSistemaAtual - valorPixEfetivo))} na Gaveta Física em dinheiro`}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* MODO MULTI (CARNÊS EM LOTE) */}
                {isMultiOpen && (
                  <View className="bg-[#09090c] p-3.5 rounded-3xl border border-amber-500/40 gap-3">
                    <View className="flex-row items-center justify-between pb-1.5 border-b border-amber-500/20">
                      <View className="flex-row items-center gap-2">
                        <View className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/40 items-center justify-center">
                          <Layers size={16} color="#fcd34d" />
                        </View>
                        <View>
                          <Text className="text-xs font-black uppercase text-amber-300 tracking-wider">
                            Carnês em Lote (Multi)
                          </Text>
                          <Text className="text-[10.5px] text-zinc-400 font-medium">
                            {parcelas.length} {parcelas.length === 1 ? "parcela adicionada" : "parcelas adicionadas"}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={addMultiParcela}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 active:scale-95 flex-row items-center gap-1.5 shadow-md"
                      >
                        <Plus size={14} color="#09090b" strokeWidth={3} />
                        <Text className="text-xs font-black uppercase text-zinc-950">
                          Adicionar
                        </Text>
                      </Pressable>
                    </View>

                    <View className="gap-3">
                      {parcelas.map((parc, idx) => (
                        <View
                          key={parc.id}
                          className="bg-[#121216] border border-zinc-800 rounded-2xl p-3.5 gap-2.5"
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                              <View className="h-6 w-6 rounded-full bg-amber-500/20 border border-amber-500/40 items-center justify-center flex-shrink-0">
                                <Text className="text-xs font-mono font-black text-amber-300">
                                  {idx + 1}
                                </Text>
                              </View>
                              <Text className="text-xs font-black text-white uppercase tracking-wider">
                                Parcela #{idx + 1}
                              </Text>
                            </View>

                            <Pressable
                              onPress={() => removeMultiParcela(parc.id)}
                              className="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 active:bg-red-500/20 flex-row items-center gap-1"
                              hitSlop={8}
                            >
                              <Trash2 size={13} color="#f87171" />
                              <Text className="text-xs font-bold text-red-400">
                                Excluir
                              </Text>
                            </Pressable>
                          </View>

                          <View className="flex-row gap-2">
                            <View className="flex-1 bg-[#09090c] border border-zinc-800 rounded-xl p-2.5 px-3">
                              <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                Valor da Parcela
                              </Text>
                              <View className="flex-row items-center">
                                <Text className="text-zinc-500 text-xs font-bold mr-1">R$</Text>
                                <MoneyInput
                                  value={parc.valor}
                                  onChangeValue={(v) => updateMultiParcela(parc.id, "valor", v)}
                                  className="flex-1 text-lg text-amber-300 font-mono font-black"
                                  placeholder="0,00"
                                  placeholderTextColor="#52525b"
                                />
                              </View>
                            </View>

                            <View className="w-28 bg-[#09090c] border border-zinc-800 rounded-xl px-2 justify-center min-h-[46px]">
                              <TextInput
                                value={parc.contrato}
                                onChangeText={(t) => updateMultiParcela(parc.id, "contrato", t)}
                                placeholder="Nº Contrato"
                                placeholderTextColor="#52525b"
                                className="text-xs text-center text-zinc-200 font-mono font-black uppercase"
                              />
                            </View>
                          </View>

                          {/* Campo de Nome no Multi (Sem título, placeholder direto) */}
                          <View className="bg-[#09090c] border border-zinc-800 rounded-xl px-3.5 justify-center min-h-[46px]">
                            <TextInput
                              value={parc.descricao}
                              onChangeText={(t) => updateMultiParcela(parc.id, "descricao", t)}
                              placeholder="Cliente / Observação..."
                              placeholderTextColor="#52525b"
                              className="text-sm text-white font-bold"
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Separador tipo do novo lançamento */}
                <View className="h-[1px] bg-zinc-800/80 my-1" />

                {/* =================================================================== */}
                {/* FLUXO DO FORMULÁRIO: 1. SISTEMA -> 2. DESCRIÇÃO -> 3. NOTAS -> 4. FEEDBACK */}
                {/* =================================================================== */}
                <View className="gap-2.5">
                  
                  {/* 1. VALOR DO SISTEMA (DESTAQUE VISUAL PRINCIPAL - MAIOR E MAIS NÍTIDO) */}
                  <View className="bg-[#0d0d12] p-4 px-4.5 rounded-[22px] border border-zinc-700/90 shadow-md flex-row items-center justify-between min-h-[72px]">
                    <View className="flex-row items-center gap-3.5 flex-1 min-w-0">
                      <View
                        className={`h-11 w-11 rounded-2xl items-center justify-center flex-shrink-0 ${
                          categoria === "entrada_prestacao"
                            ? "bg-blue-500/15 border border-blue-500/30"
                            : categoria === "multiplo"
                            ? "bg-orange-500/15 border border-orange-500/30"
                            : categoria === "sangria"
                            ? "bg-red-500/15 border border-red-500/30"
                            : categoria === "cancelamento"
                            ? "bg-red-600/15 border border-red-600/30"
                            : "bg-emerald-500/15 border border-emerald-500/30"
                        }`}
                      >
                        {categoria === "entrada_prestacao" ? (
                          <ArrowDownCircle size={22} color="#60a5fa" />
                        ) : categoria === "multiplo" ? (
                          <Split size={22} color="#fb923c" />
                        ) : categoria === "compra_vista" ? (
                          <ShoppingCart size={22} color="#f4f4f5" />
                        ) : categoria === "sangria" ? (
                          <ArrowUpRight size={22} color="#f87171" />
                        ) : categoria === "cancelamento" ? (
                          <XCircle size={22} color="#ef4444" />
                        ) : (
                          <Banknote size={22} color="#34d399" />
                        )}
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-black uppercase tracking-wider text-zinc-200 leading-none mb-1">
                          {isMultiOpen
                            ? "Parcelas (Sistema)"
                            : categoria === "sangria"
                            ? "Valor da Retirada"
                            : categoria === "cancelamento"
                            ? "Valor do Estorno"
                            : "Valor do Sistema"}
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="text-zinc-500 text-sm font-bold mr-1.5">R$</Text>
                          {isMultiOpen ? (
                            <Text className="text-2xl font-black text-white font-mono">
                              {toBrl(totalSistemaAtual).replace("R$", "").trim()}
                            </Text>
                          ) : (
                            <MoneyInput
                              value={valorSistema}
                              onChangeValue={(v) => {
                                setValorSistema(v);
                                setPreConfirmado(false);
                              }}
                              className="flex-1 text-2xl font-black text-white font-mono"
                              placeholder="0,00"
                              placeholderTextColor="#52525b"
                            />
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* 2. CAMPOS DE TEXTO: DESCRIÇÃO & CONTRATO (SEM TÍTULO SUPERIOR, PLACEHOLDER DIRETO E TEXTO MAIOR) */}
                  {!isMultiOpen && (
                    <View className="flex-row gap-2">
                      {/* Campo de Nome (Cliente / Descrição) */}
                      <View className="flex-1 bg-[#09090c] px-4 rounded-2xl border border-zinc-800 focus-within:border-zinc-500 justify-center min-h-[54px]">
                        <TextInput
                          ref={descricaoRef}
                          value={descricao}
                          onChangeText={(t) => {
                            setDescricao(t);
                            setPreConfirmado(false);
                          }}
                          placeholder={
                            isSaida ? "Motivo da saída..." : "Cliente / Descrição..."
                          }
                          placeholderTextColor="#52525b"
                          style={{ paddingVertical: 0, paddingHorizontal: 0, includeFontPadding: false }}
                          className="text-[15.5px] font-bold text-white leading-tight"
                        />
                      </View>

                      {/* Campo de Contrato Compacto ao Lado */}
                      {!isSaida && (
                        <View className="w-28 bg-[#09090c] px-2 rounded-2xl border border-zinc-800 justify-center min-h-[54px]">
                          <TextInput
                            value={codigoContrato}
                            onChangeText={(t) => {
                              setCodigoContrato(t);
                              setPreConfirmado(false);
                            }}
                            placeholder="Nº Contrato"
                            placeholderTextColor="#52525b"
                            style={{ paddingVertical: 0, paddingHorizontal: 0, includeFontPadding: false }}
                            className="text-[13px] font-mono font-black text-center text-zinc-200 uppercase"
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* SEPARADOR ENTRE DESCRIÇÃO E NOTAS ENTREGUES */}
                  {!isSaida && <View className="h-[1px] bg-zinc-800/80 my-0.5" />}

                  {/* 3. VALOR RECEBIDO (NOTAS ENTREGUES / FICOU NA GAVETA) */}
                  {!isSaida && (
                    <View className="bg-[#0d0d12] p-4 px-4.5 rounded-[22px] border border-zinc-700/90 shadow-md flex-row items-center justify-between min-h-[72px]">
                      <View className="flex-row items-center gap-3.5 flex-1 min-w-0">
                        <View className="h-11 w-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center flex-shrink-0">
                          <ArrowDownLeft size={22} color="#34d399" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs font-black uppercase tracking-wider text-emerald-400 leading-none mb-1">
                            Notas Entregues (Ficou na Gaveta)
                          </Text>
                          <View className="flex-row items-center">
                            <Text className="text-zinc-500 text-sm font-bold mr-1.5">R$</Text>
                            <MoneyInput
                              value={valorEntregueSimples}
                              onChangeValue={(v) => {
                                setValorEntregueSimples(v);
                                setPreConfirmado(false);
                              }}
                              className="flex-1 text-2xl font-black text-emerald-300 font-mono"
                              placeholder="0,00"
                              placeholderTextColor="#52525b"
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 4. CARD DE FEEDBACK VISUAL: SOBRA & GAVETA FINAL (DOCK CLÁSSICO) */}
                  {!isSaida && (
                    <View
                      className={`rounded-2xl border p-3.5 px-4 flex-row items-center justify-between shadow-sm ${
                        trocoSobra > 0.001
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : trocoSobra < -0.001
                          ? "bg-red-500/10 border-red-500/30"
                          : isPixAtivo
                          ? "bg-purple-500/10 border-purple-500/30"
                          : "bg-[#121216] border-zinc-800"
                      }`}
                    >
                      {/* Lado Esquerdo: SOBRA / FALTA */}
                      <View>
                        <View className="flex-row items-center gap-1.5 mb-0.5">
                          {trocoSobra > 0.001 ? (
                            <Coins size={12} color="#34d399" />
                          ) : trocoSobra < -0.001 ? (
                            <AlertTriangle size={12} color="#f87171" />
                          ) : isPixAtivo ? (
                            <Smartphone size={12} color="#c084fc" />
                          ) : (
                            <Check size={12} color="#60a5fa" strokeWidth={3} />
                          )}
                          <Text
                            className={`text-[10px] uppercase font-black tracking-wider ${
                              trocoSobra > 0.001
                                ? "text-emerald-400"
                                : trocoSobra < -0.001
                                ? "text-red-400"
                                : isPixAtivo
                                ? "text-purple-300"
                                : "text-blue-400"
                            }`}
                          >
                            {trocoSobra > 0.001
                              ? "Sobra"
                              : trocoSobra < -0.001
                              ? "Falta"
                              : isPixTotal100
                              ? "Pix 100%"
                              : isPixAtivo
                              ? "Pix Parcial"
                              : "Valor Exato"}
                          </Text>
                        </View>

                        <Text
                          className={`text-xl font-black font-mono leading-tight ${
                            trocoSobra > 0.001
                              ? "text-emerald-300"
                              : trocoSobra < -0.001
                              ? "text-red-300"
                              : isPixAtivo
                              ? "text-purple-200"
                              : "text-blue-300"
                          }`}
                        >
                          {trocoSobra > 0.001
                            ? `+ ${toBrl(trocoSobra)}`
                            : trocoSobra < -0.001
                            ? `- ${toBrl(Math.abs(trocoSobra))}`
                            : "R$ 0,00"}
                        </Text>
                      </View>

                      {/* Lado Direito: GAVETA FINAL */}
                      <View className="items-end">
                        <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">
                          Gaveta Final
                        </Text>
                        <Text className="text-lg font-black text-zinc-100 font-mono leading-tight">
                          {toBrl(valorFisicoEntregue)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 5. CAMPO DE TROCO DEVOLVIDO (QUANDO ATIVADO) */}
                  {isTrocoOpen && !isSaida && (
                    <View className="bg-[#09090c] p-3.5 px-4 rounded-2xl border border-zinc-800 flex-row items-center justify-between min-h-[60px]">
                      <View className="flex-row items-center gap-3 flex-1 min-w-0">
                        <View className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                          <ArrowUpRight size={18} color="#a1a1aa" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 leading-none mb-1">
                            Troco Devolvido ao Cliente
                          </Text>
                          <View className="flex-row items-center">
                            <Text className="text-zinc-500 text-sm font-bold mr-1.5">R$</Text>
                            <MoneyInput
                              value={valorTrocoDevolvido}
                              onChangeValue={(v) => {
                                setValorTrocoDevolvido(v);
                                setPreConfirmado(false);
                              }}
                              className="flex-1 text-xl font-black text-white font-mono"
                              placeholder="0,00"
                              placeholderTextColor="#52525b"
                            />
                          </View>
                        </View>
                      </View>

                      <Pressable
                        onPress={handleToggleTroco}
                        className="p-1.5"
                        hitSlop={8}
                      >
                        <X size={16} color="#71717a" />
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* VÍNCULO DE VENDA (QUANDO ESTORNO) */}
                {categoria === "cancelamento" && (
                  <View className="bg-[#09090c] p-3.5 rounded-2xl border border-red-500/30 gap-2">
                    <Pressable
                      onPress={() => setMostrarTransacoesVinculo(!mostrarTransacoesVinculo)}
                      className="flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-black uppercase text-red-400">
                        {transacaoVinculadaId ? "Venda Vinculada" : "Vincular Venda Original"}
                      </Text>
                      <Text className="text-xs font-bold text-blue-400 uppercase">
                        {transacaoVinculadaId ? "Alterar" : "Buscar"}
                      </Text>
                    </Pressable>

                    {mostrarTransacoesVinculo && (
                      <View className="mt-2 bg-[#121216] rounded-xl border border-zinc-800 p-2.5 max-h-[160px]">
                        <TextInput
                          value={buscaVendaVinculo}
                          onChangeText={setBuscaVendaVinculo}
                          placeholder="Buscar por cliente ou valor..."
                          placeholderTextColor="#52525b"
                          className="bg-[#09090c] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white mb-2"
                        />
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {transacoes
                            .filter(
                              (t) =>
                                t.descricao.toLowerCase().includes(buscaVendaVinculo.toLowerCase()) ||
                                t.valorSistema.toString().includes(buscaVendaVinculo)
                            )
                            .map((t) => (
                              <Pressable
                                key={t.id}
                                onPress={() => {
                                  setTransacaoVinculadaId(t.id);
                                  setMostrarTransacoesVinculo(false);
                                }}
                                className="py-2 border-b border-zinc-800/40 flex-row justify-between"
                              >
                                <Text className="text-xs text-white">{t.descricao || "Sem desc."}</Text>
                                <Text className="text-xs font-mono font-black text-emerald-400">
                                  {toBrl(t.valorSistema)}
                                </Text>
                              </Pressable>
                            ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* MENSAGEM DE ERRO */}
                {erro && (
                  <View className="rounded-xl bg-red-500/10 p-3 border border-red-500/30">
                    <Text className="text-center text-xs font-black text-red-400 uppercase">
                      {erro}
                    </Text>
                  </View>
                )}

                {/* BOTÃO SALVAR LANÇAMENTO (h-12) */}
                <View className="flex-row gap-2 pt-1 items-center">
                  {editingId && (
                    <Pressable
                      onPress={resetForm}
                      className="px-5 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center flex-row gap-1.5 active:scale-95 flex-shrink-0"
                    >
                      <X size={15} color="#a1a1aa" />
                      <Text className="text-xs font-black uppercase text-zinc-300">
                        Cancelar
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={onSalvar}
                    disabled={isSubmitting}
                    className={`flex-1 h-12 rounded-2xl ${
                      editingId ? "bg-blue-600 shadow-md" : theme.bgBtn
                    } items-center justify-center flex-row gap-2 shadow-lg active:scale-[0.98] ${
                      isSubmitting ? "opacity-70" : ""
                    }`}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator
                        size="small"
                        color={!editingId && categoria === "compra_vista" ? "#09090b" : "#ffffff"}
                      />
                    ) : (
                      <View className="flex-row items-center gap-1.5 px-2">
                        <Check
                          size={15}
                          color={!editingId && categoria === "compra_vista" ? "#09090b" : "#ffffff"}
                          strokeWidth={3}
                        />
                        <Text
                          numberOfLines={1}
                          className={`text-xs font-black uppercase tracking-wider ${
                            editingId ? "text-white" : theme.txtBtn
                          }`}
                        >
                          {preConfirmado
                            ? "Confirmar Diferença?"
                            : editingId
                            ? "Salvar Edição"
                            : theme.label}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* 3. HISTÓRICO DE LANÇAMENTOS COM BARRA DE BUSCA & FILTROS CONTÁBEIS */}
            <View className="gap-2.5 pt-1">
              {/* Cabeçalho do Histórico */}
              <View className="flex-row items-center justify-between px-1">
                <View className="flex-row items-center gap-2">
                  <HistoryIcon size={16} color="#a1a1aa" />
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-zinc-200">
                    Histórico de Hoje
                  </Text>
                </View>
                <View className="bg-[#121216] border border-zinc-800 px-2.5 py-0.5 rounded-full">
                  <Text className="text-[11px] font-black text-zinc-400">
                    {listagemFiltrada.length} lançamentos
                  </Text>
                </View>
              </View>

              {/* BARRA DE BUSCA EM TEMPO REAL */}
              <View className="bg-[#0e0e12] border border-zinc-800 rounded-2xl p-2.5 px-3.5 flex-row items-center gap-2.5 min-h-[44px]">
                <Search size={16} color="#a1a1aa" />
                <TextInput
                  value={buscaHistorico}
                  onChangeText={setBuscaHistorico}
                  placeholder="Buscar por cliente, contrato #0000 ou valor..."
                  placeholderTextColor="#52525b"
                  className="flex-1 text-xs text-white font-medium"
                />
                {buscaHistorico.length > 0 && (
                  <Pressable onPress={() => setBuscaHistorico("")} hitSlop={8}>
                    <X size={14} color="#a1a1aa" />
                  </Pressable>
                )}
              </View>

              {/* FILTROS CONTÁBEIS COM ROLAGEM 100% NATIVA TOUCH */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                overScrollMode="never"
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
                className="pb-1"
              >
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFiltroContabil("todos");
                  }}
                  className={`px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:scale-95 ${
                    filtroContabil === "todos"
                      ? "bg-zinc-200"
                      : "bg-[#121216] border border-zinc-800"
                  }`}
                >
                  <Text
                    className={`text-xs font-black uppercase ${
                      filtroContabil === "todos" ? "text-zinc-950" : "text-zinc-300"
                    }`}
                  >
                    Todos ({contagensFiltro.todos})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFiltroContabil("entradas");
                  }}
                  className={`px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:scale-95 ${
                    filtroContabil === "entradas"
                      ? "bg-zinc-200"
                      : "bg-[#121216] border border-zinc-800"
                  }`}
                >
                  <View className="w-2 h-2 rounded-full bg-emerald-500" />
                  <Text
                    className={`text-xs font-black uppercase ${
                      filtroContabil === "entradas" ? "text-zinc-950" : "text-zinc-300"
                    }`}
                  >
                    Entradas ({contagensFiltro.entradas})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFiltroContabil("sangria");
                  }}
                  className={`px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:scale-95 ${
                    filtroContabil === "sangria"
                      ? "bg-zinc-200"
                      : "bg-[#121216] border border-zinc-800"
                  }`}
                >
                  <View className="w-2 h-2 rounded-full bg-red-500" />
                  <Text
                    className={`text-xs font-black uppercase ${
                      filtroContabil === "sangria" ? "text-zinc-950" : "text-zinc-300"
                    }`}
                  >
                    Sangrias ({contagensFiltro.sangria})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFiltroContabil("estorno");
                  }}
                  className={`px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:scale-95 ${
                    filtroContabil === "estorno"
                      ? "bg-zinc-200"
                      : "bg-[#121216] border border-zinc-800"
                  }`}
                >
                  <View className="w-2 h-2 rounded-full bg-zinc-600" />
                  <Text
                    className={`text-xs font-black uppercase ${
                      filtroContabil === "estorno" ? "text-zinc-950" : "text-zinc-300"
                    }`}
                  >
                    Estornos ({contagensFiltro.estorno})
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="rounded-[32px] border border-dashed border-zinc-800 py-16 items-center justify-center mt-2">
            <Text className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
              Nenhum lançamento encontrado
            </Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

export const TransacoesScreen = memo(TransacoesScreenComponent);
