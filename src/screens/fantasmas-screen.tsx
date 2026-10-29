import { useState, useMemo, useCallback, memo } from "react";
import { Pressable, Text, TextInput, View, ScrollView, FlatList, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { MoneyInput } from "../components/common/money-input";
import { LembreteFantasma, TipoFantasma, Transacao } from "../types/domain";
import { toBrl } from "../utils/currency";
import { 
  Ghost, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  DollarSign, 
  ArrowUpRight, 
  RefreshCcw, 
  MessageSquare, 
  HelpCircle, 
  Banknote, 
  Edit3, 
  Link as LinkIcon, 
  Wallet, 
  X,
  User,
  Store,
  Users
} from "lucide-react-native";

interface FantasmasScreenProps {
  transacoes: Transacao[];
  fantasmas: LembreteFantasma[];
  onCriar: (input: {
    tipo: TipoFantasma;
    pessoa?: string;
    descricao: string;
    valorReferencia: number;
    impactaPixRepasse: boolean;
    destinoPix?: string;
    transacaoVinculadaId?: string;
  }) => Promise<void>;
  onEditar: (id: string, input: Partial<LembreteFantasma>) => Promise<void>;
  onToggleResolvido: (item: LembreteFantasma) => Promise<void>;
  onToggleComprovado: (item: LembreteFantasma) => Promise<void>;
  onExcluir: (id: string) => void;
  isFechado?: boolean;
}

const opcoes: { value: TipoFantasma; label: string; icon: any; sub: string; impact: string; color: string; showPixCheck: boolean }[] = [
  { value: "pix_recebido_gaveta_saiu", label: "Pix por Notas", icon: ArrowUpRight, sub: "Levou dinheiro da gaveta e mandou Pix.", impact: "Aumenta Pix / Diminui Gaveta", color: "#a78bfa", showPixCheck: true },
  { value: "destroca_pix_por_nota", label: "Destrocar Pix", icon: RefreshCcw, sub: "Repôs notas na gaveta p/ cobrir Pix.", impact: "Diminui Pix / Soma Gaveta", color: "#34d399", showPixCheck: false },
  { value: "dinheiro_emprestado", label: "Empréstimo", icon: Banknote, sub: "Entrada ou saída de notas avulsas.", impact: "Soma Gaveta / Sem impacto Pix", color: "#fb923c", showPixCheck: false },
  { value: "lembrete_geral", label: "Lembrete", icon: MessageSquare, sub: "Anotação rápida de conferência.", impact: "Sem impacto financeiro", color: "#71717a", showPixCheck: false },
];

const DESTINOS_PIX = [
  { key: "Meu Pix", label: "Meu Pix", icon: User },
  { key: "Outro", label: "Outro", icon: Users },
];

interface FantasmaCardProps {
  item: LembreteFantasma;
  op: (typeof opcoes)[0];
  refDescricao?: string | null;
  isFechado?: boolean;
  onEditarClick: (item: LembreteFantasma) => void;
  onExcluirClick: (id: string) => void;
  onToggleResolvidoClick: (item: LembreteFantasma) => void;
  onToggleComprovadoClick: (item: LembreteFantasma) => void;
}

const FantasmaCard = memo(function FantasmaCard({
  item,
  op,
  refDescricao,
  isFechado,
  onEditarClick,
  onExcluirClick,
  onToggleResolvidoClick,
  onToggleComprovadoClick,
}: FantasmaCardProps) {
  const Icon = op.icon;

  return (
    <View className={`rounded-[28px] bg-[#121216] p-4 border mb-3 shadow-md ${
      item.resolvido 
        ? "border-zinc-800/60 opacity-50" 
        : "border-zinc-800"
    }`}>
      {/* Topo do Card: Ícone + Infos + Ações */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center gap-3 min-w-0">
          <View 
            style={{ backgroundColor: item.resolvido ? '#27272a' : `${op.color}18`, borderColor: item.resolvido ? '#3f3f46' : `${op.color}35` }} 
            className="h-12 w-12 items-center justify-center rounded-2xl border flex-shrink-0"
          >
            <Icon size={20} color={item.resolvido ? "#71717a" : op.color} strokeWidth={2.5} />
          </View>

          <View className="flex-1 min-w-0">
            {/* Linha 1: Tipo + Pessoa */}
            <View className="flex-row items-center gap-1.5 flex-wrap mb-1">
              <Text style={{ color: op.color }} className="text-[10px] font-black uppercase tracking-widest">
                {op.label}
              </Text>
              {item.pessoa && item.pessoa !== "Meu Pix" ? (
                <View className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                  <Text className="text-[9px] font-bold text-zinc-300 uppercase" numberOfLines={1}>
                    {item.pessoa}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Linha 2: Valor Hero em Destaque */}
            <Text 
              className={`text-xl font-black font-mono tracking-tight ${item.resolvido ? "text-zinc-500 line-through" : "text-white"}`}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {toBrl(item.valorReferencia)}
            </Text>

            {/* Linha 3: Badges de Destino e Referência */}
            {(item.destinoPix || refDescricao) ? (
              <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                {item.destinoPix && (item.tipo === "pix_recebido_gaveta_saiu" || item.tipo === "destroca_pix_por_nota") ? (
                  <View className="flex-row items-center gap-1 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-md">
                    <Wallet size={9} color="#c084fc" />
                    <Text className="text-[9px] font-black text-purple-300 uppercase">
                      {item.destinoPix}
                    </Text>
                  </View>
                ) : null}

                {refDescricao ? (
                  <View className="flex-row items-center gap-1 bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 rounded-md">
                    <LinkIcon size={9} color="#60a5fa" />
                    <Text className="text-[9px] font-black text-blue-300 uppercase" numberOfLines={1}>
                      Ref: {refDescricao}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* Botões de Ação no Topo Direito */}
        {!isFechado && (
          <View className="flex-row items-center gap-1.5 ml-2 flex-shrink-0">
            <Pressable 
              onPress={() => onEditarClick(item)} 
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800"
            >
              <Edit3 size={13} color="#a1a1aa" />
            </Pressable>
            <Pressable 
              onPress={() => onExcluirClick(item.id)} 
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 active:bg-red-500/30"
            >
              <Trash2 size={13} color="#f87171" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Bloco Code Block Puro / Caixa de Referência da Nota */}
      {item.descricao ? (
        <View className="mt-3 bg-[#09090c] px-3.5 py-2.5 rounded-2xl border border-zinc-800/90">
          <Text className="text-xs font-mono font-medium text-zinc-300 leading-4" numberOfLines={2}>
            {item.descricao}
          </Text>
        </View>
      ) : null}

      {/* Rodapé: Botões de Ação Rápida */}
      <View className="flex-row gap-2 mt-3 pt-3 border-t border-zinc-800/80">
        <Pressable 
          onPress={() => {
            if (!isFechado) onToggleResolvidoClick(item);
          }} 
          disabled={isFechado} 
          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5 min-h-[40px] ${
            item.resolvido 
              ? 'bg-emerald-500/15 border-emerald-500/40' 
              : 'bg-zinc-900 border-zinc-800 active:bg-zinc-800'
          }`}
        >
          {item.resolvido 
            ? <CheckCircle2 size={15} color="#34d399" strokeWidth={2.5} /> 
            : <Circle size={15} color="#71717a" strokeWidth={2} />}
          <Text className={`text-[11px] font-black uppercase tracking-wider ${item.resolvido ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {item.resolvido ? "Resolvido" : "Resolver"}
          </Text>
        </Pressable>

        {op.showPixCheck && (
          <Pressable 
            onPress={() => {
              if (!isFechado) onToggleComprovadoClick(item);
            }} 
            disabled={isFechado} 
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5 min-h-[40px] ${
              item.comprovadoPix 
                ? 'bg-blue-500/15 border-blue-500/40' 
                : 'bg-zinc-900 border-zinc-800 active:bg-zinc-800'
            }`}
          >
            <DollarSign size={15} color={item.comprovadoPix ? "#60a5fa" : "#71717a"} strokeWidth={2.5} />
            <Text className={`text-[11px] font-black uppercase tracking-wider ${item.comprovadoPix ? 'text-blue-400' : 'text-zinc-400'}`}>
              {item.comprovadoPix ? "Pix Confirmado" : "Aguardar Pix"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

function FantasmasScreenComponent({
  transacoes,
  fantasmas,
  onCriar,
  onEditar,
  onToggleResolvido,
  onToggleComprovado,
  onExcluir,
  isFechado
}: FantasmasScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoFantasma>("pix_recebido_gaveta_saiu");
  const [pessoa, setPessoa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorReferencia, setValorReferencia] = useState(0);
  const [pixDestino, setPixDestino] = useState<"meu_pix" | "outros">("meu_pix");
  const [pixNomeOutro, setPixNomeOutro] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const selectedOp = opcoes.find(o => o.value === tipo)!;

  function resetForm() {
    setEditingId(null);
    setTipo("pix_recebido_gaveta_saiu");
    setPessoa("");
    setDescricao("");
    setValorReferencia(0);
    setPixDestino("meu_pix");
    setPixNomeOutro("");
    setErro(null);
  }

  async function onSalvar() {
    if (!pessoa.trim() && tipo !== "lembrete_geral") {
      setErro("Informe o nome do envolvido ou operador.");
      return;
    }
    if (valorReferencia <= 0 && tipo !== "lembrete_geral") {
      setErro("Informe o valor da operação.");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const destinoPixCalculado = 
      pixDestino === "outros" 
        ? (pixNomeOutro.trim() ? `Outro (${pixNomeOutro.trim()})` : "Outro") 
        : "Meu Pix";

    try {
      const payload = {
        tipo,
        pessoa: pessoa.trim() || undefined,
        descricao: descricao.trim(),
        valorReferencia,
        impactaPixRepasse: tipo === "pix_recebido_gaveta_saiu" || tipo === "destroca_pix_por_nota",
        destinoPix: tipo === "lembrete_geral" || tipo === "dinheiro_emprestado" ? undefined : destinoPixCalculado,
      };
      if (editingId) {
        await onEditar(editingId, payload);
      } else {
        await onCriar(payload);
      }
      resetForm();
    } catch (e) {
      setErro("Erro ao salvar.");
    }
  }

  const txMap = useMemo(() => {
    const map = new Map<string, Transacao>();
    for (const t of transacoes) {
      map.set(t.id, t);
    }
    return map;
  }, [transacoes]);

  const handleEditarClick = useCallback((item: LembreteFantasma) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(item.id);
    setTipo(item.tipo);
    setPessoa(item.pessoa || "");
    setDescricao(item.descricao || "");
    setValorReferencia(item.valorReferencia);
    if (item.destinoPix?.startsWith("Outro")) {
      setPixDestino("outros");
      const match = item.destinoPix.match(/Outro \((.+)\)/);
      setPixNomeOutro(match ? match[1] : "");
    } else {
      setPixDestino("meu_pix");
      setPixNomeOutro("");
    }
  }, []);

  const handleExcluirClick = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onExcluir(id);
  }, [onExcluir]);

  const handleToggleResolvidoClick = useCallback((item: LembreteFantasma) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void onToggleResolvido(item);
  }, [onToggleResolvido]);

  const handleToggleComprovadoClick = useCallback((item: LembreteFantasma) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void onToggleComprovado(item);
  }, [onToggleComprovado]);

  const renderItem = useCallback(({ item }: { item: LembreteFantasma }) => {
    const op = opcoes.find(o => o.value === item.tipo) || opcoes[3];
    const refDescricao = item.transacaoVinculadaId ? txMap.get(item.transacaoVinculadaId)?.descricao || "Venda" : null;

    return (
      <FantasmaCard
        item={item}
        op={op}
        refDescricao={refDescricao}
        isFechado={isFechado}
        onEditarClick={handleEditarClick}
        onExcluirClick={handleExcluirClick}
        onToggleResolvidoClick={handleToggleResolvidoClick}
        onToggleComprovadoClick={handleToggleComprovadoClick}
      />
    );
  }, [txMap, isFechado, handleEditarClick, handleExcluirClick, handleToggleResolvidoClick, handleToggleComprovadoClick]);

  return (
    <FlatList
      className="flex-1"
      data={fantasmas}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      contentContainerStyle={{ paddingBottom: 140 }}
      ListHeaderComponent={
        <View className="mb-4 pt-1">
          {!isFechado && (
            <View className="rounded-[32px] border border-zinc-800 bg-[#121216] p-5 mb-5 shadow-2xl">
              {/* Cabeçalho do Card */}
              <View className="flex-row items-center justify-between px-1 mb-4">
                <View className="flex-row items-center gap-2.5">
                  <Ghost size={18} color="#c084fc" />
                  <Text className="text-xs font-black uppercase tracking-[2px] text-zinc-300">
                    {editingId ? "Editando Registro" : "Nova Nota / Fantasma"}
                  </Text>
                </View>
                {editingId && (
                  <Pressable 
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      resetForm();
                    }}
                    hitSlop={8}
                    className="flex-row items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl"
                  >
                    <X size={13} color="#a1a1aa" />
                    <Text className="text-[10px] font-black text-zinc-300 uppercase">Cancelar</Text>
                  </Pressable>
                )}
              </View>

              {/* SELETOR DE TIPOS EM CHIPS COM CORES TEMÁTICAS */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                overScrollMode="never" 
                className="mb-3.5"
                contentContainerStyle={{ gap: 8 }}
              >
                {opcoes.map((item) => {
                  const active = tipo === item.value;
                  const Icon = item.icon;
                  return (
                    <Pressable 
                      key={item.value} 
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTipo(item.value);
                      }} 
                      style={active ? {
                        backgroundColor: `${item.color}18`,
                        borderColor: `${item.color}70`,
                        borderWidth: 1.5,
                      } : undefined}
                      className={`rounded-2xl border px-4 py-3 flex-row items-center gap-2.5 ${
                        active ? 'shadow-lg' : 'bg-[#09090c] border-zinc-800'
                      }`}
                    >
                      <Icon size={16} color={active ? item.color : "#71717a"} strokeWidth={2.5} />
                      <Text 
                        style={active ? { color: item.color } : undefined}
                        className={`text-xs font-black uppercase ${active ? '' : 'text-zinc-400'}`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* CARD EXPLICATIVO DO TIPO COM DESIGN REFINADO */}
              <View 
                style={{ 
                  backgroundColor: `${selectedOp.color}08`, 
                  borderColor: `${selectedOp.color}30` 
                }}
                className="border p-4 rounded-2xl flex-row gap-3.5 items-start mb-3.5"
              >
                <View 
                  style={{ 
                    backgroundColor: `${selectedOp.color}18`, 
                    borderColor: `${selectedOp.color}35` 
                  }}
                  className="h-10 w-10 rounded-xl items-center justify-center border flex-shrink-0"
                >
                  <HelpCircle size={18} color={selectedOp.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-black uppercase text-zinc-100 mb-0.5">{selectedOp.label}</Text>
                  <Text className="text-xs text-zinc-300 leading-4 mb-2">{selectedOp.sub}</Text>
                  <View className="flex-row items-center gap-1.5 bg-[#09090c] border border-zinc-800 px-2.5 py-1 rounded-lg self-start">
                    <View style={{ backgroundColor: selectedOp.color }} className="h-1.5 w-1.5 rounded-full" />
                    <Text style={{ color: selectedOp.color }} className="text-[10px] font-black uppercase tracking-wider">
                      {selectedOp.impact}
                    </Text>
                  </View>
                </View>
              </View>

              {/* CAMPOS DO FORMULÁRIO COM ESPAÇAMENTO GENEROSO */}
              <View className="gap-3">
                {/* Campo 1: Envolvido / Título */}
                <View className="bg-[#09090c] p-4 rounded-2xl border border-zinc-800 justify-center">
                  <Text className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                    {tipo === "lembrete_geral" 
                      ? "Título do Lembrete" 
                      : tipo === "dinheiro_emprestado"
                      ? "Quem Pegou / Emprestou"
                      : "Nome do Envolvido / Operador"}
                  </Text>
                  <TextInput 
                    className="w-full text-base font-bold text-white" 
                    placeholder={
                      tipo === "lembrete_geral" 
                        ? "Título do lembrete..." 
                        : tipo === "dinheiro_emprestado"
                        ? "Nome do operador ou pessoa..."
                        : "Operador ou pessoa envolvida..."
                    } 
                    placeholderTextColor="#52525b" 
                    value={pessoa} 
                    onChangeText={setPessoa} 
                  />
                </View>

                {/* Campo 2: VALOR HERO DINÂMICO COM TEMA DA CATEGORIA */}
                {tipo !== "lembrete_geral" && (
                  <View 
                    style={{ borderColor: `${selectedOp.color}40` }}
                    className="bg-[#0d0d12] p-4 rounded-2xl border shadow-md flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 min-w-0">
                      <View 
                        style={{ 
                          backgroundColor: `${selectedOp.color}15`, 
                          borderColor: `${selectedOp.color}30` 
                        }}
                        className="h-12 w-12 rounded-2xl border items-center justify-center flex-shrink-0"
                      >
                        <selectedOp.icon size={22} color={selectedOp.color} strokeWidth={2.2} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text 
                          style={{ color: selectedOp.color }}
                          className="text-[10px] font-black uppercase tracking-widest mb-1"
                        >
                          Valor da Operação
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="text-zinc-500 text-base font-bold mr-1.5">R$</Text>
                          <MoneyInput 
                            placeholder="0,00" 
                            className="flex-1 text-2xl font-black text-white font-mono" 
                            value={valorReferencia} 
                            onChangeValue={setValorReferencia} 
                            placeholderTextColor="#52525b"
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Campo 3: Destino/Origem do Pix com QUEM e sub-campo quando Outro */}
                {(tipo === "pix_recebido_gaveta_saiu" || tipo === "destroca_pix_por_nota") && (
                  <View 
                    style={{ borderColor: `${selectedOp.color}40` }}
                    className="bg-[#09090c] p-3.5 px-4 rounded-2xl border"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text 
                        style={{ color: selectedOp.color }}
                        className="text-xs font-black uppercase tracking-wider"
                      >
                        {tipo === "destroca_pix_por_nota" ? "ORIGEM DO PIX:" : "DESTINO DO PIX:"}
                      </Text>
                      <View 
                        style={{ borderColor: `${selectedOp.color}40` }}
                        className="flex-row gap-1 bg-[#121216] p-1 rounded-xl border"
                      >
                        <Pressable 
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setPixDestino("meu_pix");
                            setPixNomeOutro("");
                          }} 
                          style={pixDestino === "meu_pix" ? { backgroundColor: selectedOp.color } : undefined}
                          className={`px-3.5 py-1.5 rounded-lg flex-row items-center gap-1.5 ${
                            pixDestino === "meu_pix" ? "shadow-sm" : "bg-transparent"
                          }`}
                        >
                          <User 
                            size={12} 
                            color={pixDestino === "meu_pix" ? "#09090b" : "#a1a1aa"} 
                          />
                          <Text 
                            className={`text-[11px] font-black uppercase ${
                              pixDestino === "meu_pix" ? "text-zinc-950" : "text-zinc-400"
                            }`}
                          >
                            Meu Pix
                          </Text>
                        </Pressable>

                        <Pressable 
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setPixDestino("outros");
                          }} 
                          style={pixDestino === "outros" ? { backgroundColor: selectedOp.color } : undefined}
                          className={`px-3.5 py-1.5 rounded-lg flex-row items-center gap-1.5 ${
                            pixDestino === "outros" ? "shadow-sm" : "bg-transparent"
                          }`}
                        >
                          <Users 
                            size={12} 
                            color={pixDestino === "outros" ? "#09090b" : "#a1a1aa"} 
                          />
                          <Text 
                            className={`text-[11px] font-black uppercase ${
                              pixDestino === "outros" ? "text-zinc-950" : "text-zinc-400"
                            }`}
                          >
                            Outro
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Campo QUEM (Nome do Titular do Pix quando Outro) */}
                    {pixDestino === "outros" && (
                      <View 
                        style={{ borderColor: `${selectedOp.color}45` }}
                        className="bg-[#121216] p-3 px-3.5 rounded-xl border mt-2.5"
                      >
                        <Text 
                          style={{ color: selectedOp.color }}
                          className="text-[10px] font-bold uppercase tracking-wider mb-1"
                        >
                          {tipo === "destroca_pix_por_nota" 
                            ? "Nome de quem enviou o Pix:" 
                            : "Nome de quem recebeu o Pix:"}
                        </Text>
                        <TextInput 
                          value={pixNomeOutro} 
                          onChangeText={setPixNomeOutro} 
                          placeholder={
                            tipo === "destroca_pix_por_nota"
                              ? "Digite o nome de quem enviou o Pix..."
                              : "Digite o nome (ex: Vendedor, Gerente...)"
                          } 
                          placeholderTextColor="#52525b" 
                          style={{ paddingVertical: 0, paddingHorizontal: 0, includeFontPadding: false }} 
                          className="text-sm font-bold text-white" 
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Campo 4: Detalhes / Observação */}
                <View className="bg-[#09090c] p-4 rounded-2xl border border-zinc-800 justify-center">
                  <Text className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                    Detalhes / Observação (Opcional)
                  </Text>
                  <TextInput 
                    className="w-full text-sm text-zinc-200 font-medium leading-5" 
                    placeholder="Observações ou motivo da nota..." 
                    placeholderTextColor="#52525b" 
                    multiline 
                    numberOfLines={2} 
                    value={descricao} 
                    onChangeText={setDescricao} 
                  />
                </View>

                {erro && (
                  <Text className="text-center text-xs uppercase text-red-400 font-black bg-red-500/10 py-3 rounded-2xl border border-red-500/20">
                    {erro}
                  </Text>
                )}

                {/* Botões de Ação */}
                <View className="flex-row items-center gap-2.5 pt-2">
                  {editingId && (
                    <Pressable 
                      className="px-6 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800" 
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        resetForm();
                      }}
                    >
                      <View className="flex-row items-center gap-2">
                        <X size={16} color="#a1a1aa" />
                        <Text className="text-xs font-black uppercase text-zinc-300 tracking-wider">Cancelar</Text>
                      </View>
                    </Pressable>
                  )}
                  <Pressable 
                    className="flex-1 h-14 rounded-2xl bg-zinc-100 items-center justify-center flex-row gap-2 active:bg-zinc-200 shadow-xl" 
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      void onSalvar();
                    }}
                  >
                    {editingId ? (
                      <CheckCircle2 size={16} color="#09090b" strokeWidth={2.5} />
                    ) : (
                      <Ghost size={16} color="#09090b" strokeWidth={2.2} />
                    )}
                    <Text className="font-black uppercase text-zinc-950 text-xs tracking-wider">
                      {editingId ? "Salvar Alterações" : "Registrar Fantasma"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-between px-1 mb-2">
            <Text className="text-xs font-black uppercase tracking-[2px] text-zinc-400">
              Registros Ativos ({fantasmas.length})
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View className="rounded-3xl border border-dashed border-zinc-800 py-14 items-center justify-center mt-2 bg-[#121216]/40">
          <Ghost size={32} color="#3f3f46" strokeWidth={1.5} />
          <Text className="mt-2.5 text-zinc-400 font-bold uppercase tracking-wider text-xs">
            Nenhum fantasma ou nota
          </Text>
        </View>
      }
    />
  );
}

export const FantasmasScreen = memo(FantasmasScreenComponent);
