import React, { useState, useMemo, useEffect } from "react";
import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { 
  AlertTriangle, 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  User, 
  Utensils, 
  Package, 
  MapPin, 
  Sparkles, 
  Swords, 
  Zap, 
  HelpCircle,
  Clock,
  ShieldCheck,
  Flame
} from "lucide-react-native";
import { 
  JogoChatPayload, 
  JogoStopEstado, 
  StopRespostas, 
  ValidacaoStop, 
  StatusValidacaoItem 
} from "../../../types/domain";
import { 
  validarPrimeiraLetraStop, 
  normalizarPalavraStop 
} from "../../../services/games/stop-service";

interface StopCardProps {
  jogo: JogoChatPayload;
  mensagemId: string;
  myUserId: string;
  myUsername?: string | null;
  onSubmeterRespostas: (respostas: StopRespostas, acionouStop: boolean) => Promise<void>;
  onAlternarValidacao: (alvoJogador: "j1" | "j2", categoria: keyof ValidacaoStop) => Promise<void>;
  onFinalizarRodada: () => Promise<void>;
  onReiniciar: () => void;
  timestamp: number;
  isMe: boolean;
}

export const StopCard: React.FC<StopCardProps> = ({
  jogo,
  mensagemId,
  myUserId,
  myUsername,
  onSubmeterRespostas,
  onAlternarValidacao,
  onFinalizarRodada,
  onReiniciar,
  timestamp,
  isMe,
}) => {
  const estado = jogo.estado as JogoStopEstado;
  const isJ1 = myUserId === jogo.jogador1Id;
  const isJ2 = myUserId === jogo.jogador2Id;
  const isParticipante = isJ1 || isJ2;

  const meuNome = isJ1 ? jogo.jogador1Nome : jogo.jogador2Nome;
  const nomeOponente = isJ1 ? jogo.jogador2Nome : jogo.jogador1Nome;
  const meuPronto = isJ1 ? estado.jogador1Pronto : estado.jogador2Pronto;
  const oponentePronto = isJ1 ? estado.jogador2Pronto : estado.jogador1Pronto;

  const minhasRespostasSalvas = isJ1 ? estado.jogador1Respostas : estado.jogador2Respostas;
  const respostasOponente = isJ1 ? estado.jogador2Respostas : estado.jogador1Respostas;

  // Estado local dos inputs durante a fase de escrita
  const [nomeInput, setNomeInput] = useState("");
  const [comidaInput, setComidaInput] = useState("");
  const [objetoInput, setObjetoInput] = useState("");
  const [lugarInput, setLugarInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincroniza se já havia respostas salvas localmente ou limpa ao iniciar nova rodada
  useEffect(() => {
    if (minhasRespostasSalvas) {
      setNomeInput(minhasRespostasSalvas.nome || "");
      setComidaInput(minhasRespostasSalvas.comida || "");
      setObjetoInput(minhasRespostasSalvas.objeto || "");
      setLugarInput(minhasRespostasSalvas.lugar || "");
    } else {
      setNomeInput("");
      setComidaInput("");
      setObjetoInput("");
      setLugarInput("");
    }
  }, [minhasRespostasSalvas, estado.rodada, estado.letraSorteada, estado.fase]);

  const letra = estado.letraSorteada || "A";

  // Validação rica em tempo real das entradas
  const getValidationFeedback = (input: string) => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return null;
    if (!trimmed.toUpperCase().startsWith(letra)) {
      return { ok: false, msg: `✕ Comece com ${letra}` };
    }
    if (trimmed.length < 3) {
      return { ok: false, msg: "✕ Mín. 3 letras" };
    }
    if (/^(.)\1+$/i.test(trimmed)) {
      return { ok: false, msg: "✕ Letras repetidas" };
    }
    return { ok: true, msg: "✓ Pronto" };
  };

  const fNome = useMemo(() => getValidationFeedback(nomeInput), [nomeInput, letra]);
  const fComida = useMemo(() => getValidationFeedback(comidaInput), [comidaInput, letra]);
  const fObjeto = useMemo(() => getValidationFeedback(objetoInput), [objetoInput, letra]);
  const fLugar = useMemo(() => getValidationFeedback(lugarInput), [lugarInput, letra]);

  const vNome = fNome?.ok === true;
  const vComida = fComida?.ok === true;
  const vObjeto = fObjeto?.ok === true;
  const vLugar = fLugar?.ok === true;

  const totalPreenchidos = [nomeInput, comidaInput, objetoInput, lugarInput].filter(x => x.trim().length > 0).length;
  const todosValidosLetra = vNome && vComida && vObjeto && vLugar;

  const handleEnviarStop = async (acionouStop: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const respostas: StopRespostas = {
        nome: nomeInput.trim(),
        comida: comidaInput.trim(),
        objeto: objetoInput.trim(),
        lugar: lugarInput.trim(),
      };
      await onSubmeterRespostas(respostas, acionouStop);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBadgeStatus = (status?: StatusValidacaoItem, motivo?: string) => {
    if (status === "valido") {
      return (
        <View className="items-start gap-0.5">
          <View className="flex-row items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-lg">
            <CheckCircle2 size={11} color="#34d399" />
            <Text className="text-[10px] font-black text-emerald-400">+10 pts</Text>
          </View>
          <Text className="text-[8.5px] text-emerald-400/90 font-bold ml-0.5">✓ Válido</Text>
        </View>
      );
    }
    if (status === "repetido") {
      return (
        <View className="items-start gap-0.5">
          <View className="flex-row items-center gap-1 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-lg">
            <Sparkles size={11} color="#fbbf24" />
            <Text className="text-[10px] font-black text-amber-400">+5 pts</Text>
          </View>
          <Text className="text-[8.5px] text-amber-400/90 font-bold ml-0.5">Repetido</Text>
        </View>
      );
    }
    return (
      <View className="items-start gap-0.5">
        <View className="flex-row items-center gap-1 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg">
          <XCircle size={11} color="#f87171" />
          <Text className="text-[10px] font-black text-rose-400">0 pts</Text>
        </View>
        {motivo ? (
          <Text className="text-[8.5px] text-rose-400/90 font-bold ml-0.5" numberOfLines={1}>
            ✕ {motivo}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View className="w-full max-w-[340px] rounded-2xl bg-[#0f0f15] border border-amber-500/30 overflow-hidden shadow-xl my-1">
      {/* HEADER ARCADE */}
      <View className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 py-2.5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 items-center justify-center">
            <Flame size={15} color="#fbbf24" />
          </View>
          <View>
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xs font-black text-white tracking-wider">STOP! ADEDONHA</Text>
              <View className="bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                <Text className="text-[8px] font-black text-amber-400 uppercase">1v1</Text>
              </View>
            </View>
            <Text className="text-[9.5px] text-zinc-400 font-medium">
              Rodada #{estado.rodada || 1} • Placar: {jogo.placar?.jogador1 || 0} x {jogo.placar?.jogador2 || 0}
            </Text>
          </View>
        </View>
      </View>

      <View className="p-3.5">
        {/* LETRA EM DESTAQUE HOLOGRÁFICO */}
        <View className="bg-zinc-900/90 border border-amber-500/30 rounded-xl p-3 mb-3 items-center justify-center relative overflow-hidden">
          <View className="absolute -right-4 -bottom-4 opacity-5">
            <Flame size={80} color="#fbbf24" />
          </View>
          
          <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
            LETRA DA RODADA
          </Text>
          <View className="w-14 h-14 rounded-2xl bg-amber-500/15 border-2 border-amber-400 items-center justify-center shadow-lg shadow-amber-500/20 mb-1">
            <Text className="text-3xl font-black text-amber-300 font-mono">{letra}</Text>
          </View>
          <Text className="text-[10px] text-amber-400/90 font-semibold">
            Todas as respostas devem começar com a letra "{letra}"
          </Text>
        </View>

        {/* FASE 1: JOGANDO / STOP ACIONADO */}
        {(estado.fase === "jogando" || estado.fase === "stop_acionado") && (
          <View>
            {/* ALERTA DE STOP ACIONADO */}
            {estado.fase === "stop_acionado" && (
              <View className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-2.5 mb-3 flex-row items-center gap-2">
                <AlertTriangle size={18} color="#f87171" />
                <View className="flex-1">
                  <Text className="text-[11px] font-black text-rose-300">
                    {estado.quemParouId === myUserId ? "VOCÊ APERTOU STOP! 🚨" : `${nomeOponente.toUpperCase()} APERTOU STOP! 🚨`}
                  </Text>
                  <Text className="text-[9.5px] text-rose-200/80">
                    {estado.quemParouId === myUserId 
                      ? "Aguardando seu oponente enviar as respostas dele..."
                      : "Entregue o que conseguiu responder antes que a rodada encerre!"}
                  </Text>
                </View>
              </View>
            )}

            {/* SE O JOGADOR ATUAL AINDA NÃO ENVIOU: FORMULÁRIO DE ENTRADA */}
            {!meuPronto && isParticipante ? (
              <View className="gap-2 mb-3">
                {/* 1. NOME */}
                <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2">
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center gap-1.5">
                      <User size={13} color="#a1a1aa" />
                      <Text className="text-[10.5px] font-bold text-zinc-300">Nome</Text>
                    </View>
                    {fNome && (
                      <Text className={`text-[9.5px] font-bold ${fNome.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fNome.msg}
                      </Text>
                    )}
                  </View>
                  <TextInput
                    value={nomeInput}
                    onChangeText={setNomeInput}
                    placeholder={`Ex: ${letra === 'B' ? 'Bruno' : letra + '...'}`}
                    placeholderTextColor="#52525b"
                    className="text-xs text-white font-medium p-0"
                    autoCapitalize="words"
                    maxLength={25}
                  />
                </View>

                {/* 2. COMIDA */}
                <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2">
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center gap-1.5">
                      <Utensils size={13} color="#a1a1aa" />
                      <Text className="text-[10.5px] font-bold text-zinc-300">Comida / Fruta</Text>
                    </View>
                    {fComida && (
                      <Text className={`text-[9.5px] font-bold ${fComida.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fComida.msg}
                      </Text>
                    )}
                  </View>
                  <TextInput
                    value={comidaInput}
                    onChangeText={setComidaInput}
                    placeholder={`Ex: ${letra === 'B' ? 'Batata' : letra + '...'}`}
                    placeholderTextColor="#52525b"
                    className="text-xs text-white font-medium p-0"
                    autoCapitalize="words"
                    maxLength={25}
                  />
                </View>

                {/* 3. OBJETO */}
                <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2">
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center gap-1.5">
                      <Package size={13} color="#a1a1aa" />
                      <Text className="text-[10.5px] font-bold text-zinc-300">Objeto</Text>
                    </View>
                    {fObjeto && (
                      <Text className={`text-[9.5px] font-bold ${fObjeto.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fObjeto.msg}
                      </Text>
                    )}
                  </View>
                  <TextInput
                    value={objetoInput}
                    onChangeText={setObjetoInput}
                    placeholder={`Ex: ${letra === 'B' ? 'Bola' : letra + '...'}`}
                    placeholderTextColor="#52525b"
                    className="text-xs text-white font-medium p-0"
                    autoCapitalize="words"
                    maxLength={25}
                  />
                </View>

                {/* 4. LUGAR / CIDADE */}
                <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2">
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center gap-1.5">
                      <MapPin size={13} color="#a1a1aa" />
                      <Text className="text-[10.5px] font-bold text-zinc-300">Cidade / País / Lugar</Text>
                    </View>
                    {fLugar && (
                      <Text className={`text-[9.5px] font-bold ${fLugar.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fLugar.msg}
                      </Text>
                    )}
                  </View>
                  <TextInput
                    value={lugarInput}
                    onChangeText={setLugarInput}
                    placeholder={`Ex: ${letra === 'B' ? 'Brasil' : letra + '...'}`}
                    placeholderTextColor="#52525b"
                    className="text-xs text-white font-medium p-0"
                    autoCapitalize="words"
                    maxLength={25}
                  />
                </View>

                {/* BOTÃO DE AÇÃO (STOP OU ENTREGAR) */}
                {estado.fase === "stop_acionado" ? (
                  <Pressable
                    className="w-full h-11 bg-rose-600 active:bg-rose-500 rounded-xl items-center justify-center flex-row gap-2 shadow-lg shadow-rose-600/30 mt-1"
                    onPress={() => void handleEnviarStop(false)}
                    disabled={isSubmitting}
                  >
                    <CheckCircle2 size={16} color="#fff" />
                    <Text className="text-xs font-black text-white uppercase tracking-wider">
                      {isSubmitting ? "Enviando..." : "Entregar Minhas Respostas"}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    className={`w-full h-11 rounded-xl items-center justify-center flex-row gap-2 shadow-lg mt-1 ${
                      todosValidosLetra 
                        ? 'bg-rose-600 active:bg-rose-500 shadow-rose-600/30' 
                        : 'bg-zinc-800 border border-zinc-700 opacity-60'
                    }`}
                    onPress={() => {
                      if (todosValidosLetra) void handleEnviarStop(true);
                    }}
                    disabled={!todosValidosLetra || isSubmitting}
                  >
                    <Flame size={16} color={todosValidosLetra ? "#fff" : "#71717a"} />
                    <Text className={`text-xs font-black uppercase tracking-wider ${todosValidosLetra ? 'text-white' : 'text-zinc-400'}`}>
                      {isSubmitting ? "Acionando..." : todosValidosLetra ? "🚨 GRITAR STOP!" : `Preencha os 4 (${totalPreenchidos}/4)`}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              /* SE O JOGADOR JÁ ENVIOU: CARD DE AGUARDO */
              <View className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 mb-3">
                <View className="flex-row items-center gap-2 mb-2">
                  <ShieldCheck size={16} color="#34d399" />
                  <Text className="text-xs font-black text-emerald-400">Suas respostas estão prontas!</Text>
                </View>
                <View className="bg-black/40 rounded-lg p-2.5 gap-1 mb-2">
                  <Text className="text-[10px] text-zinc-300">👤 <Text className="font-bold">{minhasRespostasSalvas?.nome || "(Vazio)"}</Text></Text>
                  <Text className="text-[10px] text-zinc-300">🍕 <Text className="font-bold">{minhasRespostasSalvas?.comida || "(Vazio)"}</Text></Text>
                  <Text className="text-[10px] text-zinc-300">📦 <Text className="font-bold">{minhasRespostasSalvas?.objeto || "(Vazio)"}</Text></Text>
                  <Text className="text-[10px] text-zinc-300">🌍 <Text className="font-bold">{minhasRespostasSalvas?.lugar || "(Vazio)"}</Text></Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Clock size={12} color="#fbbf24" />
                  <Text className="text-[10px] text-amber-400 font-medium">
                    Aguardando {nomeOponente} enviar as respostas dele...
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* FASE 2: CONFERÊNCIA & AUDITORIA DAS PALAVRAS */}
        {estado.fase === "conferencia" && (
          <View className="mb-3">
            <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 mb-2.5 flex-row items-center gap-2">
              <Zap size={16} color="#fbbf24" />
              <View className="flex-1">
                <Text className="text-[11px] font-black text-amber-300">AUDITORIA DE RESPOSTAS ⚖️</Text>
                <Text className="text-[9.5px] text-zinc-400">
                  Toque nos selos de pontuação para alternar (+10, +5 ou 0 pts) se discordar.
                </Text>
              </View>
            </View>

            <View className="gap-2">
              {/* ITEM: NOME */}
              <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">👤 Nome</Text>
                <View className="flex-row items-center justify-between gap-2">
                  {/* J1 */}
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j1", "nome")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador1Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador1Respostas?.nome || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ1?.nome, estado.motivosJ1?.nome)}
                  </Pressable>
                  {/* J2 */}
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j2", "nome")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador2Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador2Respostas?.nome || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ2?.nome, estado.motivosJ2?.nome)}
                  </Pressable>
                </View>
              </View>

              {/* ITEM: COMIDA */}
              <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">🍕 Comida</Text>
                <View className="flex-row items-center justify-between gap-2">
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j1", "comida")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador1Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador1Respostas?.comida || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ1?.comida, estado.motivosJ1?.comida)}
                  </Pressable>
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j2", "comida")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador2Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador2Respostas?.comida || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ2?.comida, estado.motivosJ2?.comida)}
                  </Pressable>
                </View>
              </View>

              {/* ITEM: OBJETO */}
              <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">📦 Objeto</Text>
                <View className="flex-row items-center justify-between gap-2">
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j1", "objeto")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador1Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador1Respostas?.objeto || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ1?.objeto, estado.motivosJ1?.objeto)}
                  </Pressable>
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j2", "objeto")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador2Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador2Respostas?.objeto || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ2?.objeto, estado.motivosJ2?.objeto)}
                  </Pressable>
                </View>
              </View>

              {/* ITEM: LUGAR */}
              <View className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">🌍 Lugar / Cidade</Text>
                <View className="flex-row items-center justify-between gap-2">
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j1", "lugar")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador1Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador1Respostas?.lugar || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ1?.lugar, estado.motivosJ1?.lugar)}
                  </Pressable>
                  <Pressable 
                    className="flex-1 bg-black/40 p-2 rounded-lg border border-zinc-800/80"
                    onPress={() => void onAlternarValidacao("j2", "lugar")}
                  >
                    <Text className="text-[9px] text-zinc-400 font-bold mb-0.5">{jogo.jogador2Nome}</Text>
                    <Text className="text-xs font-black text-white mb-1" numberOfLines={1}>{estado.jogador2Respostas?.lugar || "(Vazio)"}</Text>
                    {renderBadgeStatus(estado.validacaoJ2?.lugar, estado.motivosJ2?.lugar)}
                  </Pressable>
                </View>
              </View>
            </View>

            {/* BOTÃO PARA FINALIZAR RODADA */}
            <Pressable
              className="w-full h-11 bg-emerald-600 active:bg-emerald-500 rounded-xl items-center justify-center flex-row gap-2 shadow-lg shadow-emerald-600/30 mt-3"
              onPress={() => void onFinalizarRodada()}
            >
              <Trophy size={16} color="#fff" />
              <Text className="text-xs font-black text-white uppercase tracking-wider">
                Confirmar Pontos & Ver Campeão
              </Text>
            </Pressable>
          </View>
        )}

        {/* FASE 3: FINALIZADO (PLACAR DA RODADA & VENCEDOR) */}
        {estado.fase === "finalizado" && (
          <View className="mb-1">
            <View className={`rounded-xl p-3 mb-3 border items-center justify-center ${
              jogo.status === "vitoria"
                ? 'bg-amber-500/15 border-amber-500/40'
                : 'bg-zinc-800/80 border-zinc-700'
            }`}>
              <Trophy size={28} color={jogo.status === "vitoria" ? "#fbbf24" : "#a1a1aa"} className="mb-1" />
              <Text className="text-sm font-black text-white tracking-wide mb-0.5">
                {jogo.status === "vitoria" 
                  ? `${jogo.vencedorNome} Venceu a Rodada! 🏆` 
                  : "Empate Eletrizante! 🤝"}
              </Text>
              <Text className="text-xs font-bold text-amber-300">
                {jogo.jogador1Nome}: {estado.jogador1Pontos || 0} pts  •  {jogo.jogador2Nome}: {estado.jogador2Pontos || 0} pts
              </Text>
            </View>

            {/* BOTÃO DE REVANCHE / PRÓXIMA LETRA */}
            <Pressable
              className="w-full h-11 bg-amber-500 active:bg-amber-400 rounded-xl items-center justify-center flex-row gap-2 shadow-lg shadow-amber-500/30"
              onPress={() => {
                setNomeInput("");
                setComidaInput("");
                setObjetoInput("");
                setLugarInput("");
                onReiniciar();
              }}
            >
              <RefreshCw size={15} color="#000" />
              <Text className="text-xs font-black text-black uppercase tracking-wider">
                Próxima Rodada (Nova Letra)
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};
