import React, { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import { 
  Sparkles, 
  Lightbulb, 
  Gift, 
  Send, 
  X, 
  RotateCcw, 
  Flame, 
  AlertTriangle, 
  Zap, 
  Trophy,
  Check,
  User,
  Users,
  Swords,
  Skull,
  HelpCircle
} from "lucide-react-native";
import { JogoChatPayload, JogoForcaEstado } from "../../../types/domain";
import { normalizarTextoForca } from "../../../services/games/forca-service";

interface ForcaCardProps {
  jogo: JogoChatPayload;
  mensagemId: string;
  myUserId: string;
  myUsername: string;
  onChutarLetra: (letra: string) => Promise<void>;
  onChutarPalavra: (palavra: string) => Promise<void>;
  onAdicionarDica: (dica: string) => Promise<void>;
  onPedirDica: () => Promise<void>;
  onRevelarLetra: () => Promise<void>;
  onReiniciar: () => void;
  onAbrirNovoDesafio?: () => void;
  timestamp?: number;
  isMe?: boolean;
}

const ALFABETO = [
  "A", "B", "C", "D", "E", "F", "G",
  "H", "I", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U",
  "V", "W", "X", "Y", "Z"
];

export const ForcaCard: React.FC<ForcaCardProps> = ({
  jogo,
  mensagemId,
  myUserId,
  myUsername,
  onChutarLetra,
  onChutarPalavra,
  onAdicionarDica,
  onPedirDica,
  onRevelarLetra,
  onReiniciar,
  onAbrirNovoDesafio,
  timestamp,
  isMe,
}) => {
  const estado = jogo.estado as JogoForcaEstado;
  const isModoDuelo = estado.modo === "duelo_aleatorio";

  const [modalDicaVisible, setModalDicaVisible] = useState(false);
  const [novaDicaInput, setNovaDicaInput] = useState("");
  const [modalChutePalavraVisible, setModalChutePalavraVisible] = useState(false);
  const [chutePalavraInput, setChutePalavraInput] = useState("");

  const cleanId = (myUserId || "").toLowerCase().trim();
  const cleanUser = (myUsername || "").toLowerCase().replace(/^@/, "").trim();

  const j1Id = (jogo.jogador1Id || "").toLowerCase().trim();
  const j1User = (jogo.jogador1Username || "").toLowerCase().replace(/^@/, "").trim();
  const j2Id = (jogo.jogador2Id || "").toLowerCase().trim();
  const j2User = (jogo.jogador2Username || "").toLowerCase().replace(/^@/, "").trim();

  const isJogador1 = (cleanId && j1Id === cleanId) || (cleanUser && (j1Id === cleanUser || j1User === cleanUser));
  const isJogador2 = (cleanId && j2Id === cleanId) || (cleanUser && (j2Id === cleanUser || j2User === cleanUser));
  const isParticipante = isJogador1 || isJogador2;

  const turnoId = (jogo.turnoAtualId || "").toLowerCase().trim();
  const isMeuTurno =
    jogo.status === "em_andamento" &&
    isParticipante &&
    ((isJogador1 && (turnoId === j1Id || turnoId === j1User)) ||
     (isJogador2 && (turnoId === j2Id || turnoId === j2User)));

  const isCriador = !isModoDuelo && isJogador1;
  const isAdivinhador = isModoDuelo ? isParticipante : isJogador2;

  const palavraNorm = useMemo(() => normalizarTextoForca(estado.palavraSecreta), [estado.palavraSecreta]);
  const letrasPalavra = useMemo(() => palavraNorm.split(""), [palavraNorm]);

  const vidasRestantes = Math.max(0, estado.errosMaximos - estado.errosAtuais);
  const isFinalizado = jogo.status !== "em_andamento";

  // Identificação do Vencedor
  const euVenci = isFinalizado && jogo.status === "vitoria" && (
    (isJogador1 && jogo.vencedorId === jogo.jogador1Id) ||
    (isJogador2 && jogo.vencedorId === jogo.jogador2Id)
  );
  const isEmpateColetivo = isFinalizado && (jogo.status === "empate" || !jogo.vencedorId);

  const handleEnviarDica = async () => {
    if (!novaDicaInput.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const dica = novaDicaInput.trim();
    setNovaDicaInput("");
    setModalDicaVisible(false);
    await onAdicionarDica(dica);
  };

  const handleChutarPalavraCompleta = async () => {
    if (!chutePalavraInput.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const chute = chutePalavraInput.trim();
    setChutePalavraInput("");
    setModalChutePalavraVisible(false);
    await onChutarPalavra(chute);
  };

  // Erros por membro anatômico do Holograma Cyberpunk
  const hasHead = estado.errosAtuais >= 1;
  const hasTorso = estado.errosAtuais >= 2;
  const hasLeftArm = estado.errosAtuais >= 3;
  const hasRightArm = estado.errosAtuais >= 4;
  const hasLeftLeg = estado.errosAtuais >= 5;
  const hasRightLeg = estado.errosAtuais >= 6;

  return (
    <View className="w-full max-w-[340px] rounded-3xl bg-[#080b12] border border-cyan-500/40 p-4 shadow-2xl gap-3 overflow-hidden">
      
      {/* ========================================================================= */}
      {/* 1. HEADER DO CARD COM MODO E PLACAR */}
      {/* ========================================================================= */}
      <View className="flex-row items-center justify-between pb-2 border-b border-cyan-950">
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <View className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 items-center justify-center">
            {isModoDuelo ? <Swords size={16} color="#38bdf8" /> : <HelpCircle size={16} color="#38bdf8" />}
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xs font-black uppercase tracking-wider text-white">
                Forca {isModoDuelo ? "Duelo 1v1" : "Versus"}
              </Text>
              <View className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30">
                <Text className="text-[8px] font-black uppercase text-cyan-300">
                  {isModoDuelo ? "2 JOGADORES" : "DESAFIO"}
                </Text>
              </View>
            </View>
            <Text className="text-[10px] text-cyan-300 font-bold truncate">
              {estado.tema || "Palavra Secreta"}
            </Text>
          </View>
        </View>

        {/* Vidas / Scanner */}
        <View className="flex-row items-center gap-1 bg-black/60 px-2 py-1 rounded-full border border-zinc-800">
          <Text className={`text-[10px] font-mono font-bold ${vidasRestantes <= 2 ? "text-rose-400" : "text-cyan-300"}`}>
            {vidasRestantes}/6
          </Text>
          <View className="flex-row gap-0.5 ml-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                className={`h-2 w-1.5 rounded-sm ${
                  i < vidasRestantes 
                    ? vidasRestantes <= 2 ? "bg-rose-500" : "bg-cyan-400" 
                    : "bg-zinc-800"
                }`}
              />
            ))}
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. SCANNER HOLOGRÁFICO CYBERPUNK (REPROJETADO PROFISSIONAL) */}
      {/* ========================================================================= */}
      <View className="h-32 bg-[#04060a] rounded-2xl border border-cyan-950/90 p-3 flex-row items-center justify-between overflow-hidden relative">
        
        {/* Painel da Forca e Androide Holográfico */}
        <View className="w-28 h-full justify-between items-center relative">
          
          {/* Grua / Viga Superior Mecânica */}
          <View className="w-24 h-2 bg-[#121c2b] border border-cyan-500/40 rounded-full flex-row justify-between items-center px-1">
            <View className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
            {/* Cabo Laser de Contenção */}
            <View className="w-1 h-5 bg-cyan-300 shadow-sm shadow-cyan-300/80 absolute right-4 top-1.5 z-10" />
            <View className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
          </View>

          {/* O MANEQUIM HOLOGRÁFICO PROPORCIONAL */}
          <View className="items-center justify-center -mt-1 mr-4">
            
            {/* Cabeça / Capacete Cibernético com Visor */}
            <View 
              className={`w-7 h-7 rounded-xl border items-center justify-center transition-all ${
                hasHead 
                  ? hasRightLeg 
                    ? "border-rose-500 bg-rose-950/80 shadow-md shadow-rose-500/50" 
                    : "border-cyan-400 bg-[#0c1e30] shadow-sm shadow-cyan-400/50" 
                  : "border-dashed border-zinc-800/80 bg-zinc-950/20"
              }`}
            >
              {hasHead && (
                hasRightLeg ? (
                  <Skull size={13} color="#f43f5e" />
                ) : (
                  // Visor Holográfico de LED
                  <View className="w-4 h-1 rounded-full bg-cyan-300 shadow-sm shadow-cyan-300" />
                )
              )}
            </View>

            {/* Pescoço Conector */}
            <View className={`w-1.5 h-1 ${hasTorso ? "bg-cyan-500" : "bg-transparent"}`} />

            {/* Tronco & Braços Simétricos */}
            <View className="flex-row items-center gap-1 -mt-0.5">
              
              {/* Braço Esquerdo */}
              <View 
                className={`w-2 h-7 rounded-md border ${
                  hasLeftArm 
                    ? "border-amber-400/80 bg-[#1e1a0c] shadow-xs shadow-amber-400/30" 
                    : "border-dashed border-zinc-800/60 bg-transparent"
                }`}
              />

              {/* Peitoral com Reator */}
              <View 
                className={`w-8 h-8 rounded-lg border items-center justify-center ${
                  hasTorso 
                    ? "border-cyan-400 bg-[#0c1e30] shadow-sm shadow-cyan-400/40" 
                    : "border-dashed border-zinc-800/80 bg-zinc-950/20"
                }`}
              >
                {hasTorso && (
                  <View className="w-3 h-3 rounded-full border border-cyan-300 bg-cyan-500/30 items-center justify-center">
                    <View className="w-1 h-1 rounded-full bg-cyan-200" />
                  </View>
                )}
              </View>

              {/* Braço Direito */}
              <View 
                className={`w-2 h-7 rounded-md border ${
                  hasRightArm 
                    ? "border-amber-400/80 bg-[#1e1a0c] shadow-xs shadow-amber-400/30" 
                    : "border-dashed border-zinc-800/60 bg-transparent"
                }`}
              />
            </View>

            {/* Pernas Simétricas */}
            <View className="flex-row items-center gap-2 mt-0.5">
              {/* Perna Esquerda */}
              <View 
                className={`w-2 h-7 rounded-md border ${
                  hasLeftLeg 
                    ? "border-rose-400/80 bg-[#250d14]" 
                    : "border-dashed border-zinc-800/60 bg-transparent"
                }`}
              />
              {/* Perna Direita */}
              <View 
                className={`w-2 h-7 rounded-md border ${
                  hasRightLeg 
                    ? "border-rose-500 bg-[#2f0e17] shadow-sm shadow-rose-500/50" 
                    : "border-dashed border-zinc-800/60 bg-transparent"
                }`}
              />
            </View>

          </View>

          {/* Base Magnética da Forca */}
          <View className="w-20 h-1.5 bg-[#0e1624] border border-cyan-950 rounded-full" />
        </View>

        {/* Lateral de Informações Táticas */}
        <View className="flex-1 pl-3 justify-center gap-1.5">
          {isFinalizado ? (
            euVenci ? (
              <View className="gap-1">
                <View className="flex-row items-center gap-1">
                  <Trophy size={14} color="#34d399" />
                  <Text className="text-xs font-black uppercase text-emerald-400">Vitória Sua! 🏆</Text>
                </View>
                <Text className="text-[10px] text-zinc-400 leading-3.5">
                  Você desvendou o enigma e escapou da forca!
                </Text>
              </View>
            ) : isEmpateColetivo ? (
              <View className="gap-1">
                <View className="flex-row items-center gap-1">
                  <Skull size={14} color="#f43f5e" />
                  <Text className="text-xs font-black uppercase text-rose-400">A Forca Venceu! 💀</Text>
                </View>
                <Text className="text-[10px] text-zinc-400 leading-3.5">
                  Ambos esgotaram as 6 tentativas.
                </Text>
              </View>
            ) : (
              <View className="gap-1">
                <View className="flex-row items-center gap-1">
                  <Trophy size={14} color="#fbbf24" />
                  <Text className="text-xs font-black uppercase text-amber-300">
                    Vitória de {jogo.vencedorNome || "Adversário"}
                  </Text>
                </View>
                <Text className="text-[10px] text-zinc-400 leading-3.5">
                  A palavra foi completada com sucesso.
                </Text>
              </View>
            )
          ) : (
            <View className="gap-1.5">
              {/* Indicador de Turno */}
              {isModoDuelo ? (
                <View className={`px-2 py-1 rounded-lg border ${
                  isMeuTurno 
                    ? "bg-cyan-500/20 border-cyan-400/50" 
                    : "bg-zinc-900/80 border-zinc-800"
                }`}>
                  <Text className={`text-[10px] font-black uppercase ${
                    isMeuTurno ? "text-cyan-300 animate-pulse" : "text-zinc-400"
                  }`}>
                    {isMeuTurno ? "👉 Sua vez de chutar!" : `⏳ Vez de @${(jogo.turnoAtualId === jogo.jogador1Id ? jogo.jogador1Username : jogo.jogador2Username) || "Adversário"}`}
                  </Text>
                </View>
              ) : (
                <View className="gap-0.5">
                  <View className="flex-row items-center gap-1">
                    <Flame size={12} color={vidasRestantes <= 2 ? "#f43f5e" : "#38bdf8"} />
                    <Text className={`text-[11px] font-black uppercase ${vidasRestantes <= 2 ? "text-rose-400 animate-pulse" : "text-cyan-300"}`}>
                      {vidasRestantes <= 1 ? "Última Vida!" : `${vidasRestantes} Tentativas`}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-zinc-400">
                    {isCriador ? "Aguardando chutes do amigo..." : "Adivinhe a palavra secreta!"}
                  </Text>
                </View>
              )}

              {/* Alerta SOS de Dica */}
              {estado.pediuDica && !isFinalizado && (
                <View className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 flex-row items-center gap-1">
                  <AlertTriangle size={10} color="#fbbf24" />
                  <Text className="text-[9px] font-bold text-amber-300">SOS: Pediu Dica!</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 3. FEED DE PISTAS & DICAS */}
      {/* ========================================================================= */}
      {estado.dicas.length > 0 && (
        <View className="p-2.5 rounded-xl bg-black/40 border border-cyan-950 gap-1">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Lightbulb size={12} color="#facc15" />
              <Text className="text-[10.5px] font-black uppercase text-amber-300">
                Pistas da Partida ({estado.dicas.length})
              </Text>
            </View>
            {isCriador && !isFinalizado && (
              <Pressable 
                onPress={() => setModalDicaVisible(true)}
                className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 flex-row items-center gap-1"
              >
                <Lightbulb size={9} color="#facc15" />
                <Text className="text-[9px] font-black text-amber-300 uppercase">+ Nova Dica</Text>
              </Pressable>
            )}
          </View>

          {estado.dicas.map((d, idx) => (
            <Text key={idx} className="text-[11px] text-zinc-300 leading-4">
              • {d}
            </Text>
          ))}
        </View>
      )}

      {/* ========================================================================= */}
      {/* 4. LETRAS DA PALAVRA SECRETA (SLOTS COM FEEDBACK) */}
      {/* ========================================================================= */}
      <View className="py-2 items-center">
        <View className="flex-row items-center gap-1.5 flex-wrap justify-center">
          {letrasPalavra.map((letra, index) => {
            const revelada = estado.letrasChutadas.includes(letra);
            const reveladaPorCriador = (estado.letrasReveladasPeloCriador || []).includes(letra);
            const mostrarLetra = revelada || isFinalizado;

            return (
              <View
                key={index}
                className={`w-8 h-10 rounded-lg border-b-2 items-center justify-center ${
                  reveladaPorCriador
                    ? "bg-purple-950/40 border-purple-400"
                    : revelada
                    ? "bg-cyan-950/50 border-cyan-400"
                    : isFinalizado
                    ? "bg-rose-950/30 border-rose-500"
                    : "bg-zinc-900/80 border-zinc-700"
                }`}
              >
                {mostrarLetra ? (
                  <Text className={`text-base font-black ${
                    reveladaPorCriador 
                      ? "text-purple-300" 
                      : revelada 
                      ? "text-cyan-300" 
                      : "text-rose-400"
                  }`}>
                    {letra}
                  </Text>
                ) : isCriador ? (
                  // Criador acompanha com letras semi-transparentes no modo desafio
                  <Text className="text-xs font-bold text-zinc-600">{letra}</Text>
                ) : (
                  <Text className="text-xs font-bold text-zinc-700">_</Text>
                )}
              </View>
            );
          })}
        </View>

        {isFinalizado && (
          <Text className="text-[11px] font-mono text-zinc-400 mt-2">
            Palavra Secreta: <Text className="text-white font-black">{palavraNorm}</Text>
          </Text>
        )}
      </View>

      {/* ========================================================================= */}
      {/* 5. TECLADO A-Z TOUCH (ATIVO PARA QUEM TEM O TURNO) */}
      {/* ========================================================================= */}
      {!isFinalizado && (isModoDuelo ? isMeuTurno : isAdivinhador) && (
        <View className="gap-2 pt-1 border-t border-zinc-900">
          <View className="flex-row flex-wrap gap-1 justify-center">
            {ALFABETO.map(l => {
              const chutada = estado.letrasChutadas.includes(l);
              const correta = chutada && palavraNorm.includes(l);
              const errada = chutada && !palavraNorm.includes(l);

              return (
                <Pressable
                  key={l}
                  disabled={chutada}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    void onChutarLetra(l);
                  }}
                  className={`w-7 h-8 rounded-lg items-center justify-center active:scale-95 ${
                    correta
                      ? "bg-emerald-600 border border-emerald-400 shadow-sm"
                      : errada
                      ? "bg-zinc-900/50 border border-zinc-800 opacity-30"
                      : "bg-cyan-950/60 border border-cyan-500/40"
                  }`}
                >
                  <Text className={`text-xs font-black ${
                    correta ? "text-white" : errada ? "text-zinc-600" : "text-cyan-200"
                  }`}>
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Chute Completo & SOS */}
          <View className="flex-row gap-2 mt-1">
            <Pressable
              onPress={() => setModalChutePalavraVisible(true)}
              className="flex-1 h-9 rounded-xl bg-cyan-600 border border-cyan-400 items-center justify-center flex-row gap-1.5 active:scale-98 shadow-sm"
            >
              <Zap size={13} color="#ffffff" />
              <Text className="text-[11px] font-black uppercase text-white">Chutar Palavra Toda</Text>
            </Pressable>

            {!isModoDuelo && vidasRestantes <= 3 && !estado.pediuDica && (
              <Pressable
                onPress={() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  void onPedirDica();
                }}
                className="px-3 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 items-center justify-center flex-row gap-1 active:scale-98"
              >
                <AlertTriangle size={13} color="#fbbf24" />
                <Text className="text-[10px] font-black uppercase text-amber-300">Pedir Dica</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Banner se não for a vez de jogar */}
      {!isFinalizado && isModoDuelo && !isMeuTurno && (
        <View className="py-2 px-3 rounded-xl bg-zinc-900/60 border border-zinc-800 items-center justify-center">
          <Text className="text-xs text-zinc-400 font-bold">
            Aguardando jogada do adversário no teclado...
          </Text>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 6. AÇÕES DO CRIADOR (MODO DESAFIO) */}
      {/* ========================================================================= */}
      {!isFinalizado && isCriador && (
        <View className="gap-2 pt-2 border-t border-cyan-950">
          <Text className="text-[10.5px] text-zinc-400 text-center font-medium">
            Você é o criador do enigma:
          </Text>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setModalDicaVisible(true)}
              className="flex-1 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 items-center justify-center flex-row gap-1.5 active:scale-98"
            >
              <Lightbulb size={13} color="#facc15" />
              <Text className="text-[10.5px] font-black uppercase text-amber-300">
                Dar Nova Dica
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                void onRevelarLetra();
              }}
              className="flex-1 h-9 rounded-xl bg-purple-600/30 border border-purple-500/40 items-center justify-center flex-row gap-1.5 active:scale-98"
            >
              <Gift size={13} color="#c084fc" />
              <Text className="text-[10.5px] font-black uppercase text-purple-300">
                Presentear Letra
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 7. REVANCHE INTELIGENTE COM ESCOLHA (NUNCA MAIS RESET AUTOMÁTICO INDESEJADO) */}
      {/* ========================================================================= */}
      {isFinalizado && (
        <View className="gap-2 pt-2 border-t border-cyan-950">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onReiniciar();
            }}
            className="w-full h-11 rounded-xl bg-cyan-500 border border-cyan-300 items-center justify-center flex-row gap-2 active:scale-98 shadow-md"
          >
            <RotateCcw size={15} color="#082f49" strokeWidth={2.5} />
            <Text className="text-xs font-black uppercase tracking-wider text-cyan-950" numberOfLines={1}>
              {isModoDuelo ? "Revanche 1v1 (Nova Palavra)" : "Revanche Rápida"}
            </Text>
          </Pressable>

          {onAbrirNovoDesafio && (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onAbrirNovoDesafio();
              }}
              className="w-full h-11 rounded-xl bg-cyan-950/80 border border-cyan-400 items-center justify-center flex-row gap-2 active:scale-98 shadow-sm"
            >
              <Sparkles size={15} color="#38bdf8" strokeWidth={2} />
              <Text className="text-xs font-black uppercase tracking-wider text-cyan-300" numberOfLines={1}>
                Criar Desafio Personalizado
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ENVIAR NOVA DICA */}
      {/* ========================================================================= */}
      <Modal visible={modalDicaVisible} transparent animationType="fade" onRequestClose={() => setModalDicaVisible(false)}>
        <View className="flex-1 bg-black/80 items-center justify-center p-4">
          <View className="w-full max-w-[340px] bg-[#0c0e18] border border-amber-500/40 rounded-2xl p-4 gap-3 shadow-2xl">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Lightbulb size={16} color="#facc15" />
                <Text className="text-sm font-black uppercase text-white">Enviar Nova Dica</Text>
              </View>
              <Pressable onPress={() => setModalDicaVisible(false)}>
                <X size={16} color="#a1a1aa" />
              </Pressable>
            </View>

            <Text className="text-xs text-zinc-400">
              Digite uma pista para ajudar seu colega a adivinhar <Text className="text-white font-bold">{palavraNorm}</Text>:
            </Text>

            <TextInput
              value={novaDicaInput}
              onChangeText={setNovaDicaInput}
              placeholder="Ex: É muito comum em padarias..."
              placeholderTextColor="#52525b"
              className="h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
              autoFocus
            />

            <Pressable
              onPress={handleEnviarDica}
              className="w-full h-10 rounded-xl bg-amber-500 border border-amber-400 items-center justify-center flex-row gap-2 active:scale-98"
            >
              <Send size={14} color="#000000" />
              <Text className="text-xs font-black uppercase text-black">Enviar Pista</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CHUTAR PALAVRA COMPLETA */}
      {/* ========================================================================= */}
      <Modal visible={modalChutePalavraVisible} transparent animationType="fade" onRequestClose={() => setModalChutePalavraVisible(false)}>
        <View className="flex-1 bg-black/80 items-center justify-center p-4">
          <View className="w-full max-w-[340px] bg-[#0c0e18] border border-cyan-500/40 rounded-2xl p-4 gap-3 shadow-2xl">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Zap size={16} color="#38bdf8" />
                <Text className="text-sm font-black uppercase text-white">Chutar Palavra Toda</Text>
              </View>
              <Pressable onPress={() => setModalChutePalavraVisible(false)}>
                <X size={16} color="#a1a1aa" />
              </Pressable>
            </View>

            <Text className="text-xs text-zinc-400">
              Cuidado! Se você acertar, vence na hora. Se errar, perde <Text className="text-rose-400 font-bold">2 vidas</Text> de uma vez!
            </Text>

            <TextInput
              value={chutePalavraInput}
              onChangeText={setChutePalavraInput}
              placeholder="Digite a palavra completa..."
              placeholderTextColor="#52525b"
              className="h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-black uppercase"
              autoCapitalize="characters"
              autoFocus
            />

            <Pressable
              onPress={handleChutarPalavraCompleta}
              className="w-full h-10 rounded-xl bg-cyan-500 border border-cyan-300 items-center justify-center flex-row gap-2 active:scale-98"
            >
              <Check size={14} color="#000000" />
              <Text className="text-xs font-black uppercase text-black">Confirmar Chute</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
};
