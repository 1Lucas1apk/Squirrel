import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Gamepad2, RotateCcw, Sparkles } from "lucide-react-native";
import { JogoChatPayload, JogoVelhaEstado } from "../../../types/domain";

interface JogoDaVelhaCardProps {
  jogo: JogoChatPayload;
  mensagemId: string;
  myUserId: string;
  myUsername: string;
  onJogar: (posicao: number) => void;
  onReiniciar: () => void;
  timestamp?: number;
  isMe?: boolean;
}

export const JogoDaVelhaCard: React.FC<JogoDaVelhaCardProps> = ({
  jogo,
  myUserId,
  myUsername,
  onJogar,
  onReiniciar,
  timestamp,
  isMe,
}) => {
  const estado = jogo.estado as JogoVelhaEstado;
  const tabuleiro = estado?.tabuleiro || Array(9).fill(null);
  const linhasVencedoras = estado?.linhasVencedoras || [];

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

  const meuSimbolo = isJogador1 ? "X" : isJogador2 ? "O" : null;

  const handleCellPress = (index: number) => {
    if (tabuleiro[index] !== null) return;
    if (!isMeuTurno) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onJogar(index);
  };

  const handleReiniciarPress = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReiniciar();
  };

  // Status visual banner
  let statusBadgeBg = "bg-zinc-800/80 border-zinc-700";
  let statusBadgeText = "Vez do adversário";
  let statusTextColor = "text-zinc-400";

  if (jogo.status === "vitoria") {
    const isVencedorEu = 
      (cleanId && (jogo.vencedorId || "").toLowerCase() === cleanId) ||
      (cleanUser && (jogo.vencedorNome || "").toLowerCase().includes(cleanUser));
    statusBadgeBg = isVencedorEu ? "bg-amber-500/20 border-amber-500/50" : "bg-purple-500/20 border-purple-500/50";
    statusBadgeText = isVencedorEu ? "👑 Vitória Sua!" : `🏆 Vitória de ${jogo.vencedorNome || "Adversário"}`;
    statusTextColor = isVencedorEu ? "text-amber-300" : "text-purple-300";
  } else if (jogo.status === "empate") {
    statusBadgeBg = "bg-zinc-800 border-zinc-600";
    statusBadgeText = "🤝 Empate";
    statusTextColor = "text-zinc-300";
  } else if (isMeuTurno) {
    statusBadgeBg = "bg-emerald-500/20 border-emerald-500/50";
    statusBadgeText = `🟢 Sua Vez (${meuSimbolo})`;
    statusTextColor = "text-emerald-300";
  } else {
    const nomeVez = (turnoId === j1Id || turnoId === j1User) ? jogo.jogador1Nome : jogo.jogador2Nome;
    statusBadgeBg = "bg-indigo-500/15 border-indigo-500/30";
    statusBadgeText = `⏳ Vez de ${nomeVez.split(" ")[0]}`;
    statusTextColor = "text-indigo-300";
  }

  const p1NomeCurto = (jogo.jogador1Nome || "J1").split(" ")[0];
  const p2NomeCurto = (jogo.jogador2Nome || "J2").split(" ")[0];

  return (
    <View className="my-1 w-[240px] self-center rounded-2xl bg-[#0b0b10] border border-indigo-500/30 p-2.5 shadow-lg">
      {/* Topo: Título + Badge de Vez */}
      <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
        <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-1">
          <Gamepad2 size={14} color="#818cf8" />
          <Text className="text-[10px] font-black uppercase tracking-wider text-indigo-300 truncate">
            Jogo da Velha
          </Text>
        </View>

        <View className={`px-2 py-0.5 rounded-full border ${statusBadgeBg}`}>
          <Text className={`text-[9px] font-bold ${statusTextColor}`}>
            {statusBadgeText}
          </Text>
        </View>
      </View>

      {/* Placar Acumulado */}
      <View className="flex-row items-center justify-between px-2 py-1 my-1.5 bg-[#07070a] rounded-lg border border-zinc-800/60">
        <View className="items-center flex-1">
          <Text className="text-[8.5px] uppercase font-bold text-cyan-400 truncate max-w-[65px]" numberOfLines={1}>
            {p1NomeCurto} (X)
          </Text>
          <Text className="text-xs font-black text-white">
            {jogo.placar?.jogador1 ?? 0}
          </Text>
        </View>

        <View className="h-4 w-[1px] bg-zinc-800" />

        <View className="items-center flex-1">
          <Text className="text-[8.5px] uppercase font-bold text-zinc-500">
            Empates
          </Text>
          <Text className="text-xs font-black text-zinc-400">
            {jogo.placar?.empates ?? 0}
          </Text>
        </View>

        <View className="h-4 w-[1px] bg-zinc-800" />

        <View className="items-center flex-1">
          <Text className="text-[8.5px] uppercase font-bold text-amber-400 truncate max-w-[65px]" numberOfLines={1}>
            {p2NomeCurto} (O)
          </Text>
          <Text className="text-xs font-black text-white">
            {jogo.placar?.jogador2 ?? 0}
          </Text>
        </View>
      </View>

      {/* Tabuleiro 3x3 Perfeitamente Alinhado */}
      <View className="items-center justify-center p-1.5 bg-[#050508] rounded-xl border border-zinc-800/70">
        <View className="w-[204px] h-[204px] flex-row flex-wrap justify-between content-between">
          {tabuleiro.map((cell, idx) => {
            const isWinningCell = linhasVencedoras.includes(idx);
            const isClickable = isMeuTurno && cell === null;

            return (
              <Pressable
                key={`c-${idx}`}
                onPress={() => handleCellPress(idx)}
                disabled={!isClickable}
                className={`w-[64px] h-[64px] rounded-lg items-center justify-center border ${
                  isWinningCell
                    ? "bg-amber-500/25 border-amber-400 shadow-md scale-[1.02]"
                    : cell !== null
                    ? "bg-[#111118] border-zinc-800"
                    : isClickable
                    ? "bg-[#141420] border-indigo-500/30 active:bg-indigo-500/20 active:scale-95"
                    : "bg-[#0c0c12] border-zinc-900"
                }`}
              >
                {cell === "X" && (
                  <Text className={`text-2xl font-black text-cyan-400 ${isWinningCell ? "text-amber-300" : ""}`}>
                    ✕
                  </Text>
                )}
                {cell === "O" && (
                  <Text className={`text-2xl font-black text-amber-400 ${isWinningCell ? "text-amber-300" : ""}`}>
                    ◯
                  </Text>
                )}
                {cell === null && isClickable && (
                  <View className="h-2 w-2 rounded-full bg-indigo-500/40" />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Revanche quando a partida termina */}
      {jogo.status !== "em_andamento" ? (
        <Pressable
          onPress={handleReiniciarPress}
          className="mt-2 w-full py-2 rounded-xl bg-indigo-600 border border-indigo-400/40 flex-row items-center justify-center gap-1.5 active:scale-95 shadow"
        >
          <RotateCcw size={12} color="#ffffff" />
          <Text className="text-[11px] font-black uppercase text-white tracking-wider">
            Revanche
          </Text>
        </Pressable>
      ) : isMeuTurno ? (
        <View className="mt-1.5 flex-row items-center justify-center gap-1 py-0.5">
          <Sparkles size={10} color="#34d399" />
          <Text className="text-[9.5px] font-bold text-emerald-400">
            {tabuleiro.every(c => c === null) ? "Você inicia esta rodada! Toque para jogar." : "Sua vez! Toque em uma casa vazia."}
          </Text>
        </View>
      ) : (
        <View className="mt-1.5 flex-row items-center justify-center gap-1 py-0.5">
          <Text className="text-[9.5px] font-bold text-zinc-500">
            {tabuleiro.every(c => c === null) 
              ? `${(turnoId === j1Id || turnoId === j1User ? jogo.jogador1Nome : jogo.jogador2Nome).split(" ")[0]} inicia esta rodada...` 
              : `Aguardando ${(turnoId === j1Id || turnoId === j1User ? jogo.jogador1Nome : jogo.jogador2Nome).split(" ")[0]} jogar...`}
          </Text>
        </View>
      )}

      {/* Rodapé do Card com Hora */}
      {timestamp ? (
        <View className="mt-1 flex-row items-center justify-end gap-1">
          <Text className="text-[9px] font-mono text-zinc-500">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
