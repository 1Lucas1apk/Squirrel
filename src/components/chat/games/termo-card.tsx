import React, { useState, useMemo, useRef } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { Sparkles, RotateCcw, CornerDownLeft, Eye, HelpCircle, Keyboard as KeyboardIcon } from "lucide-react-native";
import { JogoChatPayload, JogoTermoEstado, StatusLetraTermo } from "../../../types/domain";
import { MAX_TENTATIVAS, TAMANHO_PALAVRA } from "../../../services/games/termo-service";

interface TermoCardProps {
  jogo: JogoChatPayload;
  mensagemId: string;
  myUserId: string;
  myUsername: string;
  onEnviarPalpite: (palpite: string) => void;
  onReiniciar: () => void;
  timestamp?: number;
  isMe?: boolean;
}

export const TermoCard: React.FC<TermoCardProps> = ({
  jogo,
  myUserId,
  myUsername,
  onEnviarPalpite,
  onReiniciar,
  timestamp,
  isMe,
}) => {
  const estado = jogo.estado as JogoTermoEstado;
  const [palpiteDigitado, setPalpiteDigitado] = useState("");
  const [visualizandoAdversario, setVisualizandoAdversario] = useState(false);
  const inputRef = useRef<TextInput>(null);

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

  // Palpites
  const meusPalpites = isJogador1 ? (estado?.jogador1Palpites || []) : (estado?.jogador2Palpites || []);
  const palpitesInimigos = isJogador1 ? (estado?.jogador2Palpites || []) : (estado?.jogador1Palpites || []);

  const palpitesExibidos = visualizandoAdversario ? palpitesInimigos : meusPalpites;
  const isGameOver = jogo.status === "vitoria" || jogo.status === "empate";

  // Mapeamento de letras descobertas pelo jogador ativo
  const { letrasCorretas, letrasPresentes, letrasAusentes } = useMemo(() => {
    const corretas = new Set<string>();
    const presentes = new Set<string>();
    const ausentes = new Set<string>();

    meusPalpites.forEach(p => {
      p.palavra.split("").forEach((letra, i) => {
        const feedback = p.feedback[i];
        if (feedback === "correto") {
          corretas.add(letra);
          presentes.delete(letra);
        } else if (feedback === "presente" && !corretas.has(letra)) {
          presentes.add(letra);
        } else if (feedback === "ausente" && !corretas.has(letra) && !presentes.has(letra)) {
          ausentes.add(letra);
        }
      });
    });

    return {
      letrasCorretas: Array.from(corretas),
      letrasPresentes: Array.from(presentes),
      letrasAusentes: Array.from(ausentes),
    };
  }, [meusPalpites]);

  const handleEnviar = () => {
    if (!isMeuTurno || isGameOver) return;
    const chuteLimpo = palpiteDigitado.toUpperCase().replace(/[^A-Z]/g, "").trim();
    if (chuteLimpo.length !== TAMANHO_PALAVRA) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onEnviarPalpite(chuteLimpo);
    setPalpiteDigitado("");
  };

  const handleReiniciarPress = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPalpiteDigitado("");
    setVisualizandoAdversario(false);
    onReiniciar();
  };

  // Cores dos blocos
  const getBlockBgColor = (status?: StatusLetraTermo, ocultaLetra?: boolean) => {
    if (!status) return "bg-zinc-900/60 border-zinc-800/80";
    if (ocultaLetra) return "bg-zinc-800/80 border-zinc-700";
    switch (status) {
      case "correto":
        return "bg-emerald-600 border-emerald-400 shadow-sm shadow-emerald-600/30";
      case "presente":
        return "bg-amber-500 border-amber-300 shadow-sm shadow-amber-500/30";
      case "ausente":
        return "bg-zinc-800 border-zinc-700/80";
      default:
        return "bg-zinc-900/60 border-zinc-800/80";
    }
  };

  // Status visual banner
  let statusBadgeBg = "bg-zinc-800/80 border-zinc-700";
  let statusBadgeText = "Vez do adversário";
  let statusTextColor = "text-zinc-400";

  if (jogo.status === "vitoria") {
    const isVencedorEu =
      (cleanId && (jogo.vencedorId || "").toLowerCase() === cleanId) ||
      (cleanUser && (jogo.vencedorNome || "").toLowerCase().includes(cleanUser));
    statusBadgeBg = isVencedorEu ? "bg-emerald-500/20 border-emerald-500/50" : "bg-purple-500/20 border-purple-500/50";
    statusBadgeText = isVencedorEu ? "👑 Você Acertou a Palavra!" : `🏆 Vitória de ${jogo.vencedorNome || "Adversário"}`;
    statusTextColor = isVencedorEu ? "text-emerald-300" : "text-purple-300";
  } else if (jogo.status === "empate") {
    statusBadgeBg = "bg-zinc-700/30 border-zinc-600";
    statusBadgeText = "🤝 Empate! Ninguém acertou";
    statusTextColor = "text-zinc-300";
  } else if (isMeuTurno) {
    statusBadgeBg = "bg-emerald-500/20 border-emerald-500/50";
    statusBadgeText = "🟢 Sua vez! Digite no teclado";
    statusTextColor = "text-emerald-300";
  }

  return (
    <View className="w-full rounded-2xl bg-[#0b0c10] border border-zinc-800/80 p-3.5 gap-2.5 overflow-hidden shadow-xl">
      {/* Topo do Card: Título + Placar */}
      <View className="flex-row items-center justify-between pb-1.5 border-b border-zinc-800/60">
        <View className="flex-row items-center gap-1.5">
          <View className="h-6 w-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 items-center justify-center">
            <Sparkles size={12} color="#34d399" />
          </View>
          <Text className="text-xs font-black tracking-wider uppercase text-emerald-400">
            Termo Versus
          </Text>
        </View>

        {/* Placar 1v1 */}
        <View className="flex-row items-center gap-1.5 bg-zinc-900/90 px-2.5 py-0.5 rounded-full border border-zinc-800">
          <Text className="text-[10.5px] font-bold text-zinc-300">
            {jogo.jogador1Nome.split(" ")[0]}: <Text className="text-emerald-400">{jogo.placar?.jogador1 ?? 0}</Text>
          </Text>
          <Text className="text-[9px] text-zinc-600">x</Text>
          <Text className="text-[10.5px] font-bold text-zinc-300">
            {jogo.jogador2Nome.split(" ")[0]}: <Text className="text-purple-400">{jogo.placar?.jogador2 ?? 0}</Text>
          </Text>
        </View>
      </View>

      {/* Dica (se for desafio personalizado) */}
      {Boolean(estado?.dica) && (
        <View className="flex-row items-center gap-1.5 bg-purple-950/30 border border-purple-800/40 px-2.5 py-1 rounded-lg">
          <HelpCircle size={11} color="#c084fc" />
          <Text className="text-[10px] font-semibold text-purple-300">
            Dica: <Text className="text-white font-bold">{estado.dica}</Text>
          </Text>
        </View>
      )}

      {/* Banner de Status do Turno */}
      <View className={`py-1.5 px-2.5 rounded-xl border flex-row items-center justify-between ${statusBadgeBg}`}>
        <Text className={`text-[11px] font-black uppercase tracking-wider ${statusTextColor}`}>
          {statusBadgeText}
        </Text>
        <Text className="text-[10px] font-bold text-zinc-400">
          {visualizandoAdversario ? `Adversário (${palpitesInimigos.length}/6)` : `Tentativa ${meusPalpites.length + 1}/6`}
        </Text>
      </View>

      {/* Alternador de Visualização (Meu Tabuleiro x Adversário) */}
      <View className="flex-row items-center justify-center gap-2">
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setVisualizandoAdversario(false);
          }}
          className={`px-3 py-1 rounded-full border ${
            !visualizandoAdversario ? "bg-emerald-500/20 border-emerald-500/50" : "bg-zinc-900 border-zinc-800"
          }`}
        >
          <Text className={`text-[10px] font-black uppercase ${!visualizandoAdversario ? "text-emerald-300" : "text-zinc-500"}`}>
            Meu Tabuleiro
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setVisualizandoAdversario(true);
          }}
          className={`px-3 py-1 rounded-full border flex-row items-center gap-1 ${
            visualizandoAdversario ? "bg-purple-500/20 border-purple-500/50" : "bg-zinc-900 border-zinc-800"
          }`}
        >
          <Eye size={10} color={visualizandoAdversario ? "#c084fc" : "#71717a"} />
          <Text className={`text-[10px] font-black uppercase ${visualizandoAdversario ? "text-purple-300" : "text-zinc-500"}`}>
            Adversário ({palpitesInimigos.length})
          </Text>
        </Pressable>
      </View>

      {/* Grade do Termo (6 Linhas x 5 Letras) - Tocar na grade foca o Gboard */}
      <Pressable 
        onPress={() => {
          if (isMeuTurno && !isGameOver && !visualizandoAdversario) {
            inputRef.current?.focus();
          }
        }}
        className="items-center justify-center gap-1.5 my-1"
      >
        {Array.from({ length: MAX_TENTATIVAS }).map((_, linhaIdx) => {
          const palpiteExistente = palpitesExibidos[linhaIdx];
          const isLinhaAtiva = !visualizandoAdversario && linhaIdx === meusPalpites.length && isMeuTurno && !isGameOver;

          return (
            <View key={linhaIdx} className="flex-row gap-1.5">
              {Array.from({ length: TAMANHO_PALAVRA }).map((__, colIdx) => {
                let letra = "";
                let status: StatusLetraTermo | undefined = undefined;

                if (palpiteExistente) {
                  status = palpiteExistente.feedback[colIdx];
                  // Fog of War: Oculta letras do adversário até o fim da partida!
                  if (visualizandoAdversario && !isGameOver) {
                    letra = "?";
                  } else {
                    letra = palpiteExistente.palavra[colIdx] || "";
                  }
                } else if (isLinhaAtiva) {
                  letra = palpiteDigitado[colIdx] || "";
                }

                const isCurrentCursor = isLinhaAtiva && colIdx === palpiteDigitado.length;
                const blockBorder = isCurrentCursor
                  ? "border-emerald-400 bg-emerald-950/20 shadow-md shadow-emerald-500/20"
                  : isLinhaAtiva && letra
                  ? "border-indigo-400/80 bg-zinc-900"
                  : getBlockBgColor(status, visualizandoAdversario && !isGameOver);

                return (
                  <View
                    key={colIdx}
                    className={`w-10 h-10 rounded-xl border items-center justify-center ${blockBorder}`}
                  >
                    <Text className={`text-lg font-black uppercase ${status === "ausente" ? "text-zinc-400" : "text-white"}`}>
                      {letra}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </Pressable>

      {/* Revelação da Palavra ao Fim de Jogo */}
      {isGameOver && (
        <View className="items-center justify-center p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 gap-1">
          <Text className="text-[10px] uppercase font-bold text-zinc-400">Palavra Secreta Revelada:</Text>
          <Text className="text-lg font-black tracking-widest text-amber-300 uppercase">
            {estado.palavraSecreta.split("").join(" ")}
          </Text>
        </View>
      )}

      {/* Campo INLINE com Teclado Nativo (Gboard / Android / iOS) */}
      {isMeuTurno && !isGameOver && !visualizandoAdversario && (
        <View className="mt-1 gap-1.5 pt-2 border-t border-zinc-800/80">
          <View className="flex-row items-center gap-2">
            {/* Input Nativo do Gboard - min-w-0 e sem tracking excessivo para não estourar a caixa */}
            <View className="flex-1 min-w-0 flex-row items-center bg-zinc-900/90 border border-emerald-500/40 rounded-xl px-2.5 h-11">
              <KeyboardIcon size={15} color="#34d399" />
              <TextInput
                ref={inputRef}
                value={palpiteDigitado}
                onChangeText={(txt) => {
                  const limpo = txt.toUpperCase().replace(/[^A-Z]/g, "").slice(0, TAMANHO_PALAVRA);
                  setPalpiteDigitado(limpo);
                }}
                placeholder="5 letras..."
                placeholderTextColor="#52525b"
                maxLength={TAMANHO_PALAVRA}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleEnviar}
                className="flex-1 min-w-0 ml-2 font-black text-sm text-white uppercase"
                style={{ paddingVertical: 0 }}
              />
              <Text className="text-[10px] font-mono font-bold text-zinc-400 ml-1">
                {palpiteDigitado.length}/5
              </Text>
            </View>

            {/* Botão Chutar */}
            <Pressable
              onPress={handleEnviar}
              disabled={palpiteDigitado.length !== TAMANHO_PALAVRA}
              className={`h-11 px-3.5 rounded-xl flex-row items-center justify-center gap-1.5 flex-shrink-0 active:scale-95 ${
                palpiteDigitado.length === TAMANHO_PALAVRA
                  ? "bg-emerald-600 border border-emerald-400 shadow-md shadow-emerald-600/30"
                  : "bg-zinc-800/80 border border-zinc-700/60 opacity-40"
              }`}
            >
              <CornerDownLeft size={13} color="#ffffff" strokeWidth={2.5} />
              <Text className="text-xs font-black uppercase text-white tracking-wider">
                Chutar
              </Text>
            </Pressable>
          </View>

          {/* Tracker Compacto e Elegante de Letras Já Descobertas */}
          {(letrasCorretas.length > 0 || letrasPresentes.length > 0 || letrasAusentes.length > 0) && (
            <View className="p-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 gap-1">
              {/* Letras Certas (Verdes) e Amarelas */}
              {(letrasCorretas.length > 0 || letrasPresentes.length > 0) && (
                <View className="flex-row items-center gap-1 flex-wrap">
                  <Text className="text-[9px] font-bold text-zinc-400 mr-1">No jogo:</Text>
                  {letrasCorretas.map(l => (
                    <View key={l} className="h-5 px-1.5 rounded bg-emerald-600 border border-emerald-400 items-center justify-center">
                      <Text className="text-[9.5px] font-black text-white">{l}</Text>
                    </View>
                  ))}
                  {letrasPresentes.map(l => (
                    <View key={l} className="h-5 px-1.5 rounded bg-amber-500 border border-amber-300 items-center justify-center">
                      <Text className="text-[9.5px] font-black text-white">{l}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Letras Eliminadas (Cinzas) */}
              {letrasAusentes.length > 0 && (
                <View className="flex-row items-center gap-1 flex-wrap">
                  <Text className="text-[9px] font-bold text-zinc-500 mr-1">Eliminadas:</Text>
                  <Text className="text-[9.5px] font-mono text-zinc-500 tracking-wider">
                    {letrasAusentes.join(" ")}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Botão de Revanche / Jogar Novamente */}
      {isGameOver && (
        <Pressable
          onPress={handleReiniciarPress}
          className="mt-1 py-2.5 px-4 rounded-xl bg-emerald-600 border border-emerald-400 items-center justify-center flex-row gap-2 active:bg-emerald-500 shadow-md shadow-emerald-600/30"
        >
          <RotateCcw size={14} color="#ffffff" />
          <Text className="text-xs font-black uppercase text-white tracking-wider">
            Revanche no Termo
          </Text>
        </Pressable>
      )}
    </View>
  );
};
