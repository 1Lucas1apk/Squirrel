import { useState, useRef } from "react";
import { Pressable, Text, TextInput, View, Modal, FlatList, ScrollView } from "react-native";
import { Search, CheckCircle2, Circle, AlertCircle, Trash2, Link as LinkIcon, Filter, Target, Cloud, History, Clock, X } from "lucide-react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { MoneyInput } from "../components/common/money-input";
import { TabSwitcher } from "../components/common/tab-switcher";
import { LogAlteracao, Transacao, RegistroPOS, RegistroConvenio } from "../types/domain";
import { toBrl } from "../utils/currency";

interface ChecklistScreenProps {
  transacoes: Transacao[];
  pos: RegistroPOS[];
  convenios: RegistroConvenio[];
  logs?: LogAlteracao[];
  onToggle: (transacao: Transacao) => Promise<void>;
  onTogglePOS?: (id: string, current: string) => Promise<void>;
  onToggleConvenio?: (id: string, current: string) => Promise<void>;
  onExcluir: (id: string) => void;
  onReportarErro: (id: string, valorSistemaNovo: number, valorReal: number, justificativa: string) => Promise<void>;
  isFechado?: boolean;
}

function getCategoriaLabel(categoria: Transacao["categoria"]) {
  const map: Record<Transacao["categoria"], string> = {
    dinheiro: "Dinheiro",
    entrada_prestacao: "Entrada",
    compra_vista: "À Vista",
    gar: "GAR",
    multiplo: "Múltiplo",
    sangria: "Sangria",
    cancelamento: "Cancelamento",
  };
  return map[categoria];
}

function ChecklistItem({ item, logs, isFechado, onToggle, onExcluir, onAbrirErro }: any) {
  const swipeableRef = useRef<Swipeable>(null);
  const isConfirmada = item.statusConferencia === "confirmada";
  const isCancelamento = item.categoria === "cancelamento";

  const accentColors: Record<Transacao["categoria"], string> = {
    dinheiro: "#34d399",
    entrada_prestacao: "#60a5fa",
    compra_vista: "#f4f4f5",
    multiplo: "#fb923c",
    sangria: "#f87171",
    cancelamento: "#ef4444",
    gar: "#a78bfa"
  };

  const color = accentColors[item.categoria as Transacao["categoria"]] || "#71717a";
  const itemLogs = (logs || []).filter((l: LogAlteracao) => l.transacaoId === item.id);

  const renderLeftActions = () => {
    return (
      <View className="bg-emerald-500 justify-center items-start pl-8 pr-12 rounded-[32px] flex-1">
        <CheckCircle2 size={32} color="#fff" />
      </View>
    );
  };

  const renderRightActions = () => {
    return (
      <View className="bg-red-500 justify-center items-end pr-8 pl-12 rounded-[32px] flex-1">
        <AlertCircle size={32} color="#fff" />
      </View>
    );
  };

  return (
    <View className="mb-4">
      <Swipeable
        ref={swipeableRef}
        enabled={!isFechado}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        overshootFriction={8}
        onSwipeableOpen={(direction) => {
          swipeableRef.current?.close();
          if (direction === "left") {
            onToggle(item);
          } else if (direction === "right") {
            onAbrirErro(item);
          }
        }}
      >
        <View className={`rounded-[32px] border p-6 shadow-sm bg-ink-900 ${isConfirmada
            ? "border-emerald-500/20 bg-emerald-500/5 opacity-40"
            : item.statusConferencia === "incorreto"
              ? "border-red-500/40 bg-red-500/10"
              : isCancelamento
                ? "border-red-500/40 bg-red-500/10"
                : "border-zinc-800"
          }`}>
          <View className="flex-row items-center justify-between">
            <Pressable
              className="flex-1"
              disabled={isFechado}
              onLongPress={() => !isFechado && onAbrirErro(item)}
              delayLongPress={500}
            >
              <View className="flex-row items-center gap-2 mb-2 flex-wrap">
                <Text style={{ color: isConfirmada ? undefined : color }} className={`text-[10px] font-black uppercase tracking-widest ${isConfirmada ? "text-emerald-500" : ""}`}>
                  {new Date(item.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {getCategoriaLabel(item.categoria)}
                </Text>
                {isCancelamento && <AlertCircle size={12} color="#f87171" />}
                {item.pendingSync && (
                  <View className="bg-amber-500/10 px-1.5 py-0.5 rounded flex-row items-center gap-1">
                    <Cloud size={8} color="#f59e0b" />
                  </View>
                )}
                {itemLogs.length > 0 && (
                  <View className="bg-blue-500/10 px-1.5 py-0.5 rounded flex-row items-center gap-1">
                    <History size={8} color="#60a5fa" />
                  </View>
                )}
              </View>
              <Text className={`text-2xl font-black tracking-tighter ${isConfirmada ? "text-zinc-600" : "text-zinc-100"}`}>
                {toBrl(item.valorSistema)}
              </Text>
              {item.statusConferencia === "incorreto" && (
                <View className="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
                  <Text className="text-[9px] font-black text-red-400 uppercase">Real Pago: {toBrl(item.valorRecebidoFisico)}</Text>
                  {item.justificativaTexto && (
                    <Text className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Obs: {item.justificativaTexto}</Text>
                  )}
                </View>
              )}
              {item.descricao && item.statusConferencia !== "incorreto" ? (
                <Text className="mt-1 text-xs font-bold text-zinc-500 uppercase tracking-tighter" numberOfLines={1}>{item.descricao}</Text>
              ) : null}

              {itemLogs.length > 0 && (
                <View className="mt-4 pt-4 border-t border-zinc-800/50">
                  {itemLogs.map((log: LogAlteracao) => (
                    <View key={log.id} className="flex-row items-center gap-2 mb-1">
                      <View className="h-1 w-1 rounded-full bg-blue-500" />
                      <Text className="text-[9px] text-zinc-400 font-bold uppercase">
                        Editado: {toBrl(log.valorAntigo)} → {toBrl(log.valorNovo)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>

            <View className="flex-row items-center gap-3">
              {!isFechado && (
                <Pressable
                  onPress={() => onExcluir(item.id)}
                  hitSlop={12}
                  className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"
                >
                  <Trash2 size={16} color="#f87171" />
                </Pressable>
              )}

              <Pressable
                disabled={isFechado}
                onPress={() => !isFechado && onToggle(item)}
                className={`h-12 w-12 items-center justify-center rounded-[20px] border-2 ${isConfirmada ? "border-emerald-500 bg-emerald-500" : "border-zinc-800 bg-ink-900"
                  }`}
              >
                {isConfirmada ? (
                  <CheckCircle2 size={24} color="#064e3b" strokeWidth={3} />
                ) : (
                  <Circle size={24} color="#3f3f46" strokeWidth={3} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Swipeable>
    </View>
  );
}

export function ChecklistScreen({ transacoes, pos, convenios, logs, onToggle, onTogglePOS, onToggleConvenio, onExcluir, onReportarErro, isFechado }: ChecklistScreenProps) {
  const [modoChecagem, setModoChecagem] = useState<"transacoes" | "outros">("transacoes");

  const [busca, setBusca] = useState("");
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("todas");
  const [subAbaDinheiro, setSubAbaDinheiro] = useState<"todas" | "especie" | "multiplo" | "gar">("todas");

  const [horaInicio, setHoraInicio] = useState<number | null>(null);
  const [horaFim, setHoraFim] = useState<number | null>(null);
  const [showTimeFilter, setShowTimeFilter] = useState(false);

  const [itemEmErro, setItemEmErro] = useState<string | null>(null);
  const [valorSistemaNovo, setValorSistemaNovo] = useState(0);
  const [valorRealPago, setValorRealPago] = useState(0);
  const [notaErro, setNotaErro] = useState("");

  const transacoesPorAba = transacoes.filter((t) => {
    if (abaAtiva === "dinheiro") {
      if (subAbaDinheiro === "especie") return t.categoria === "dinheiro";
      if (subAbaDinheiro === "multiplo") return t.categoria === "multiplo";
      if (subAbaDinheiro === "gar") return t.categoria === "gar";
      return t.categoria === "dinheiro" || t.categoria === "multiplo" || t.categoria === "gar";
    }
    if (abaAtiva === "entradas") return t.categoria === "entrada_prestacao";
    if (abaAtiva === "avista") return t.categoria === "compra_vista";
    if (abaAtiva === "saidas") return t.categoria === "sangria" || t.categoria === "cancelamento";
    return true;
  });

  const transacoesFiltradas = transacoesPorAba.filter((t) => {
    if (apenasPendentes && t.statusConferencia === "confirmada") return false;
    if (horaInicio !== null || horaFim !== null) {
      const itemHour = new Date(t.timestamp).getHours();
      if (horaInicio !== null && itemHour < horaInicio) return false;
      if (horaFim !== null && itemHour > horaFim) return false;
    }
    if (!busca) return true;
    const valorStr = t.valorSistema.toString().replace(".", ",");
    return valorStr.includes(busca) || t.descricao.toLowerCase().includes(busca.toLowerCase());
  });

  const calcNetTotal = (list: Transacao[]) => {
    return list.reduce((acc, t) => {
      const isSaida = t.categoria === "sangria" || t.categoria === "cancelamento";
      return isSaida ? acc - t.valorSistema : acc + t.valorSistema;
    }, 0);
  };

  const totalEsperado = calcNetTotal(transacoesPorAba);
  const totalConfirmado = calcNetTotal(transacoesPorAba.filter(t => t.statusConferencia === "confirmada"));

  const totalItens = transacoesPorAba.length;
  const itensConfirmados = transacoesPorAba.filter(t => t.statusConferencia === "confirmada").length;
  const progresso = totalItens > 0 ? (itensConfirmados / totalItens) * 100 : 0;

  const renderOutrosItem = ({ item }: { item: RegistroPOS | RegistroConvenio }) => {
    const isPOS = "tipo" in item;
    const isGas = isPOS && item.tipo === "gas_do_povo";
    const isPix = isPOS && item.tipo === "pix_loja";
    const label = isPOS ? (isGas ? "Gás do Povo" : isPix ? "Pix POS" : "Cartão") : "Convênio";
    
    const isConfirmada = item.statusConferencia === "confirmada";

    const colorClass = isPOS 
      ? (isGas ? "#fb923c" : isPix ? "#34d399" : "#60a5fa")
      : "#c084fc";
    const textLabel = isPOS ? label : item.nome;

    return (
      <View className={`rounded-[32px] border p-6 mb-4 shadow-sm bg-ink-900 ${isConfirmada ? "border-emerald-500/20 bg-emerald-500/5 opacity-40" : "border-zinc-800"}`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-2 flex-wrap">
              <Text style={{ color: isConfirmada ? undefined : colorClass }} className={`text-[10px] font-black uppercase tracking-widest ${isConfirmada ? "text-emerald-500" : ""}`}>
                {new Date(item.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })} • {textLabel}
              </Text>
            </View>
            <Text className={`text-2xl font-black tracking-tighter ${isConfirmada ? "text-zinc-600" : "text-zinc-100"}`}>
              {toBrl(item.valor)}
            </Text>
            <Text className={`mt-1 text-xs font-bold uppercase tracking-tighter ${isConfirmada ? "text-zinc-600" : "text-zinc-500"}`} numberOfLines={1}>
              {item.descricao || (isPOS ? "Lançamento POS" : "Lançamento Convênio")}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            {!isFechado && (
              <Pressable
                disabled={isFechado}
                onPress={() => {
                  if (isPOS && onTogglePOS) onTogglePOS(item.id, item.statusConferencia || "pendente");
                  if (!isPOS && onToggleConvenio) onToggleConvenio(item.id, item.statusConferencia || "pendente");
                }}
                className={`h-12 w-12 items-center justify-center rounded-[20px] border-2 ${isConfirmada ? "border-emerald-500 bg-emerald-500" : "border-zinc-800 bg-ink-900"
                  }`}
              >
                {isConfirmada ? (
                  <CheckCircle2 size={24} color="#064e3b" strokeWidth={3} />
                ) : (
                  <Circle size={24} color="#3f3f46" strokeWidth={3} />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Transacao }) => {
    return (
      <ChecklistItem
        key={item.id}
        item={item}
        logs={logs}
        isFechado={isFechado}
        onToggle={onToggle}
        onExcluir={onExcluir}
        onAbrirErro={(t: Transacao) => {
          setValorSistemaNovo(t.valorSistema);
          setValorRealPago(t.valorRecebidoFisico);
          setItemEmErro(t.id);
        }}
      />
    );
  };

  return (
    <View className="flex-1">
      <Modal
        animationType="fade"
        transparent={true}
        visible={itemEmErro !== null}
        onRequestClose={() => setItemEmErro(null)}
      >
        <View className="flex-1 bg-black/80 items-center justify-center p-6">
          <View className="w-full max-w-[400px] rounded-[40px] border border-red-500/30 bg-ink-900 p-8 shadow-2xl">
            <Text className="text-xl font-black text-white uppercase tracking-widest mb-2">Ajuste de Valores</Text>

            <View className="flex-row gap-3 mb-6 mt-4">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1">Lançado Sistema</Text>
                <MoneyInput
                  value={valorSistemaNovo}
                  onChangeValue={setValorSistemaNovo}
                  className="w-full rounded-[24px] border border-blue-800/40 bg-blue-950/20 px-4 py-5 text-xl font-black text-blue-100"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-500 uppercase mb-2 ml-1">Real Recebido</Text>
                <MoneyInput
                  value={valorRealPago}
                  onChangeValue={setValorRealPago}
                  className="w-full rounded-[24px] border border-red-800/40 bg-red-950/20 px-4 py-5 text-xl font-black text-red-100"
                />
              </View>
            </View>

            <TextInput
              placeholder="MOTIVO DO ERRO (EX: DESCONTO CARNÊ)"
              placeholderTextColor="#450a0a"
              value={notaErro}
              onChangeText={setNotaErro}
              className="rounded-2xl border border-red-900/30 bg-red-950/10 px-5 py-4 text-red-200 font-bold text-xs mb-6 uppercase"
            />

            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 rounded-2xl bg-zinc-800 py-4"
                onPress={() => {
                  setItemEmErro(null);
                  setNotaErro("");
                }}
              >
                <Text className="text-center font-black text-zinc-400 uppercase text-[10px]">Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={!notaErro.trim()}
                className={`flex-[2] rounded-2xl py-4 ${notaErro.trim() ? 'bg-red-500' : 'bg-red-900 opacity-50'}`}
                onPress={async () => {
                  await onReportarErro(itemEmErro!, valorSistemaNovo, valorRealPago, notaErro.trim());
                  setItemEmErro(null);
                  setNotaErro("");
                }}
              >
                <Text className="text-center font-black text-white uppercase text-[10px]">Confirmar Ajuste</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        className="flex-1"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        ListHeaderComponent={
          <View className="gap-5 mb-4">
            <View className="flex-row gap-2 bg-ink-900 p-2 rounded-[32px] border border-zinc-800">
               <Pressable onPress={() => setModoChecagem('transacoes')} className={`flex-1 py-3 rounded-[24px] items-center ${modoChecagem === 'transacoes' ? 'bg-zinc-800' : ''}`}>
                  <Text className={`text-[10px] font-black uppercase tracking-widest ${modoChecagem === 'transacoes' ? 'text-white' : 'text-zinc-500'}`}>Transações</Text>
               </Pressable>
               <Pressable onPress={() => setModoChecagem('outros')} className={`flex-1 py-3 rounded-[24px] items-center ${modoChecagem === 'outros' ? 'bg-zinc-800' : ''}`}>
                  <Text className={`text-[10px] font-black uppercase tracking-widest ${modoChecagem === 'outros' ? 'text-white' : 'text-zinc-500'}`}>POS & Convênio</Text>
               </Pressable>
            </View>

            {modoChecagem === "transacoes" && (
              <>
                <View className="rounded-[40px] border border-blue-500/20 bg-blue-500/5 p-6 shadow-2xl relative overflow-hidden">
                  <View className="flex-row items-start justify-between mb-6">
                    <View className="flex-1 pr-4">
                      <View className="flex-row items-center gap-2 opacity-60 mb-1.5">
                        <Target size={12} color="#60a5fa" />
                        <Text className="text-[10px] font-black uppercase tracking-[2px] text-blue-300">
                          Progresso da Conferência
                        </Text>
                      </View>
                      <Text className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest">{itensConfirmados} de {totalItens} Lançamentos OK</Text>
                    </View>
                    <View className="bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-2xl">
                      <Text className="text-xs font-black text-blue-400 uppercase tracking-widest">{Math.round(progresso)}%</Text>
                    </View>
                  </View>

                  <View className="flex-row items-end justify-between gap-4">
                    <View className="flex-1">
                      <Text className="text-[9px] font-black text-zinc-500 uppercase mb-1">Confirmado</Text>
                      <Text className="text-3xl font-black text-blue-400 tracking-tighter" numberOfLines={1} adjustsFontSizeToFit>{toBrl(totalConfirmado)}</Text>
                    </View>
                    <View className="items-end flex-1">
                      <Text className="text-[9px] font-black text-zinc-500 uppercase mb-1">Total a Bater</Text>
                      <Text className="text-xl font-black text-zinc-500 tracking-tighter" numberOfLines={1} adjustsFontSizeToFit>{toBrl(totalEsperado)}</Text>
                    </View>
                  </View>

                  <View className="h-1.5 w-full bg-blue-950/40 rounded-full mt-6 overflow-hidden">
                    <View
                      className="h-full bg-blue-500"
                      style={{ width: `${progresso}%` }}
                    />
                  </View>
                </View>

                <TabSwitcher
                  tabs={[
                    { key: "todas", label: "Todas" },
                    { key: "dinheiro", label: "Dinheiro" },
                    { key: "entradas", label: "Entrada" },
                    { key: "avista", label: "À Vista" },
                    { key: "saidas", label: "Saídas" },
                  ]}
                  activeKey={abaAtiva}
                  onChange={(key) => {
                    setAbaAtiva(key);
                    setSubAbaDinheiro("todas");
                  }}
                />

                {abaAtiva === "dinheiro" && (
                  <View className="-mt-3 mb-2 px-1">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {[
                        { key: "todas", label: "Geral" },
                        { key: "especie", label: "Apenas Espécie" },
                        { key: "multiplo", label: "Apenas Múltiplo" },
                        { key: "gar", label: "Apenas GAR" },
                      ].map(sub => (
                        <Pressable
                          key={sub.key}
                          onPress={() => setSubAbaDinheiro(sub.key as any)}
                          className={`px-4 py-2 rounded-xl border ${subAbaDinheiro === sub.key ? 'bg-zinc-800 border-zinc-700' : 'bg-transparent border-transparent'}`}
                        >
                          <Text className={`text-[10px] font-black uppercase tracking-wider ${subAbaDinheiro === sub.key ? 'text-zinc-300' : 'text-zinc-600'}`}>{sub.label}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            <View className="rounded-[32px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl mt-2">
              <View className="flex-row items-center gap-3 mb-4 ml-1">
                <Search size={14} color="#71717a" />
                <Text className="text-[10px] font-black uppercase tracking-[3px] text-zinc-600">
                  Localizar Recibo
                </Text>
              </View>
              <TextInput
                className="rounded-2xl border border-zinc-700 bg-ink-800 px-6 py-5 text-zinc-100 font-bold text-lg"
                placeholder="Valor ou descrição..."
                placeholderTextColor="#3f3f46"
                value={busca}
                onChangeText={setBusca}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {modoChecagem === "transacoes" && (
              <View className="flex-row items-center gap-3 px-2 mt-2">
                <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500 mr-2">
                  Filtros
                </Text>
                <Pressable
                  onPress={() => setApenasPendentes(!apenasPendentes)}
                  className={`flex-row items-center gap-2 px-4 py-2.5 rounded-2xl border ${apenasPendentes ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-800 border-zinc-700'}`}
                >
                  <Filter size={12} color={apenasPendentes ? '#f59e0b' : '#71717a'} />
                  <Text className={`text-[9px] font-black uppercase tracking-widest ${apenasPendentes ? 'text-amber-500' : 'text-zinc-400'}`}>
                    {apenasPendentes ? "Ocultar OK" : "Tudo"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowTimeFilter(!showTimeFilter)}
                  className={`flex-row items-center gap-2 px-4 py-2.5 rounded-2xl border ${horaInicio !== null || horaFim !== null ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-800 border-zinc-700'}`}
                >
                  <Clock size={12} color={horaInicio !== null || horaFim !== null ? '#60a5fa' : '#71717a'} />
                  <Text className={`text-[9px] font-black uppercase tracking-widest ${horaInicio !== null || horaFim !== null ? 'text-blue-400' : 'text-zinc-400'}`}>
                    {horaInicio !== null || horaFim !== null ? `${horaInicio}h - ${horaFim}h` : "Horário"}
                  </Text>
                </Pressable>
              </View>
            )}

            {showTimeFilter && (
              <View className="bg-ink-900 border border-zinc-800 rounded-[32px] p-6 mt-2">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Filtrar por Intervalo (Horas)</Text>
                  {(horaInicio !== null || horaFim !== null) && (
                    <Pressable onPress={() => { setHoraInicio(null); setHoraFim(null); }} className="flex-row items-center gap-1">
                      <X size={10} color="#f87171" /><Text className="text-[8px] font-black text-red-400 uppercase">Limpar</Text>
                    </Pressable>
                  )}
                </View>

                <View className="gap-6">
                  <View>
                    <Text className="text-[8px] font-black text-zinc-600 uppercase mb-2 ml-1">A partir das: {horaInicio !== null ? `${horaInicio}:00` : '--:--'}</Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(h => (
                        <Pressable key={h} onPress={() => setHoraInicio(h)} className={`h-8 w-10 items-center justify-center rounded-lg border ${horaInicio === h ? 'bg-blue-500 border-blue-500' : 'bg-ink-800 border-zinc-800'}`}>
                          <Text className={`text-[10px] font-black ${horaInicio === h ? 'text-white' : 'text-zinc-500'}`}>{h}h</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="text-[8px] font-black text-zinc-600 uppercase mb-2 ml-1">Até às: {horaFim !== null ? `${horaFim}:00` : '--:--'}</Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(h => (
                        <Pressable key={h} onPress={() => setHoraFim(h)} className={`h-8 w-10 items-center justify-center rounded-lg border ${horaFim === h ? 'bg-blue-500 border-blue-500' : 'bg-ink-800 border-zinc-800'}`}>
                          <Text className={`text-[10px] font-black ${horaFim === h ? 'text-white' : 'text-zinc-500'}`}>{h}h</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        }
        data={(modoChecagem === "transacoes" ? transacoesFiltradas : [...pos, ...convenios].filter((f: any) => !busca || (f.descricao || f.nome || '').toLowerCase().includes(busca.toLowerCase()) || f.valor.toString().includes(busca)).sort((a,b) => b.timestamp - a.timestamp)) as any[]}
        keyExtractor={(item) => item.id}
        renderItem={modoChecagem === "transacoes" ? (renderItem as any) : (renderOutrosItem as any)}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={
          <View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center mt-4">
            <Search size={32} color="#27272a" />
            <Text className="mt-4 text-zinc-600 font-black uppercase tracking-widest text-xs">Nada encontrado</Text>
          </View>
        }
      />
    </View>
  );
}
