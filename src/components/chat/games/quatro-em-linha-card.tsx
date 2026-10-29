import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Gamepad2, RotateCcw, Sparkles, ArrowDown } from "lucide-react-native";
import { JogoChatPayload, JogoQuatroLinhaEstado } from "../../../types/domain";
import { NUM_COLUNAS, NUM_LINHAS, TOTAL_CELULAS } from "../../../services/games/quatro-em-linha-service";

interface QuatroEmLinhaCardProps {
  jogo: JogoChatPayload;
  mensagemId: string;
  myUserId: string;
  myUsername: string;
  onJogarColuna: (coluna: number) => void;
  onReiniciar: () => void;
  timestamp?: number;
  isMe?: boolean;
}

export const QuatroEmLinhaCard: React.FC<QuatroEmLinhaCardProps> = ({
  jogo,
  myUserId,
  myUsername,
  onJogarColuna,
  onReiniciar,
  timestamp,
  isMe,
}) => {
  const estado = jogo.estado as JogoQuatroLinhaEstado;
  // Compatibilidade com array 1D flat (Firestore sem arrays aninhados)
  const tabuleiro: (string | null)[] = Array.isArray(estado?.tabuleiro)
    ? (Array.isArray(estado.tabuleiro[0])
        ? (estado.tabuleiro as any).flat() // caso receba mensagem legada transitória
        : estado.tabuleiro)
    : Array(TOTAL_CELULAS).fill(null);

  const linhasVencedoras = Array.isArray(estado?.linhasVencedoras)
    ? estado.linhasVencedoras
    : [];
  const ultimaJogada = estado?.ultimaJogada;

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

  const meuCor = isJogador1 ? "🔴" : isJogador2 ? "🟡" : null;

  const handleColunaPress = (colIndex: number) => {
    if (!isMeuTurno) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    // Verifica se o topo da coluna (linha 0) está ocupado
    if (tabuleiro[colIndex] !== null) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onJogarColuna(colIndex);
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
    statusBadgeText = `🟢 Sua Vez (${meuCor})`;
    statusTextColor = "text-emerald-300";
  } else {
    const nomeVez = (turnoId === j1Id || turnoId === j1User) ? jogo.jogador1Nome : jogo.jogador2Nome;
    statusBadgeBg = "bg-indigo-500/15 border-indigo-500/30";
    statusBadgeText = `⏳ Vez de ${nomeVez.split(" ")[0]}`;
    statusTextColor = "text-indigo-300";
  }

  const p1NomeCurto = (jogo.jogador1Nome || "J1").split(" ")[0];
  const p2NomeCurto = (jogo.jogador2Nome || "J2").split(" ")[0];
  const isTabuleiroVazio = tabuleiro.every(c => c === null);

  return (
    <View className="my-1 w-[260px] self-center rounded-2xl bg-[#09090e] border border-indigo-500/30 p-2.5 shadow-xl">
      {/* Cabeçalho Arcade */}
      <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
        <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-1">
          <Gamepad2 size={14} color="#818cf8" />
          <Text className="text-[10px] font-black uppercase tracking-wider text-indigo-300 truncate">
            4 em Linha
          </Text>
        </View>

        <View className={`px-2 py-0.5 rounded-full border ${statusBadgeBg}`}>
          <Text className={`text-[9px] font-bold ${statusTextColor}`}>
            {statusBadgeText}
          </Text>
        </View>
      </View>

      {/* Placar Acumulado */}
      <View className="flex-row items-center justify-between px-2 py-1 my-1.5 bg-[#050508] rounded-lg border border-zinc-800/60">
        <View className="items-center flex-1">
          <Text className="text-[8.5px] uppercase font-bold text-rose-400 truncate max-w-[65px]" numberOfLines={1}>
            🔴 {p1NomeCurto}
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
            🟡 {p2NomeCurto}
          </Text>
          <Text className="text-xs font-black text-white">
            {jogo.placar?.jogador2 ?? 0}
          </Text>
        </View>
      </View>

      {/* Botões Superiores de Despejo de Fichas (Drop) */}
      <View className="flex-row justify-between px-1 mb-1">
        {Array.from({ length: NUM_COLUNAS }).map((_, colIdx) => {
          const isColunaCheia = tabuleiro[colIdx] !== null;
          const isAtivo = isMeuTurno && !isColunaCheia && jogo.status === "em_andamento";

          return (
            <Pressable
              key={`drop-${colIdx}`}
              onPress={() => handleColunaPress(colIdx)}
              disabled={!isAtivo}
              className={`w-[29px] h-6 rounded-md items-center justify-center border ${
                isAtivo
                  ? "bg-indigo-600/30 border-indigo-400/50 active:bg-indigo-500/60 active:scale-95"
                  : isColunaCheia
                  ? "bg-transparent border-transparent opacity-20"
                  : "bg-transparent border-transparent"
              }`}
            >
              {isAtivo && <ArrowDown size={12} color="#818cf8" strokeWidth={2.5} />}
            </Pressable>
          );
        })}
      </View>

      {/* Grade 7x6 do Tabuleiro com Efeito Azul Clássico */}
      <View className="bg-[#121630] border-2 border-indigo-500/60 rounded-xl p-1.5 shadow-inner">
        {Array.from({ length: NUM_LINHAS }).map((_, rowIdx) => (
          <View key={`row-${rowIdx}`} className="flex-row justify-between my-0.5">
            {Array.from({ length: NUM_COLUNAS }).map((_, colIdx) => {
              const idx = rowIdx * NUM_COLUNAS + colIdx;
              const celula = tabuleiro[idx];
              const isWinning = linhasVencedoras.includes(idx);
              const isLastMove = ultimaJogada === idx;

              return (
                <Pressable
                  key={`cell-${rowIdx}-${colIdx}`}
                  onPress={() => handleColunaPress(colIdx)}
                  disabled={!isMeuTurno || jogo.status !== "em_andamento"}
                  className="w-[29px] h-[29px] items-center justify-center"
                >
                  <View
                    className={`w-[25px] h-[25px] rounded-full border items-center justify-center ${
                      celula === "R"
                        ? isWinning
                          ? "bg-rose-500 border-amber-300 shadow-lg scale-110"
                          : isLastMove
                          ? "bg-rose-600 border-rose-300 shadow-md"
                          : "bg-rose-600 border-rose-800"
                        : celula === "Y"
                        ? isWinning
                          ? "bg-amber-400 border-white shadow-lg scale-110"
                          : isLastMove
                          ? "bg-amber-400 border-amber-200 shadow-md"
                          : "bg-amber-500 border-amber-700"
                        : "bg-[#080a14] border-indigo-900/60"
                    }`}
                  >
                    {isWinning && (
                      <View className="h-2 w-2 rounded-full bg-white shadow-sm" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Revanche quando a partida termina */}
      {jogo.status !== "em_andamento" ? (
        <Pressable
          onPress={handleReiniciarPress}
          className="mt-2.5 w-full py-2 rounded-xl bg-indigo-600 border border-indigo-400/40 flex-row items-center justify-center gap-1.5 active:scale-95 shadow"
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
            {isTabuleiroVazio ? "Você inicia! Toque em uma coluna." : "Sua vez! Escolha uma coluna."}
          </Text>
        </View>
      ) : (
        <View className="mt-1.5 flex-row items-center justify-center gap-1 py-0.5">
          <Text className="text-[9.5px] font-bold text-zinc-500">
            {isTabuleiroVazio
              ? `${(turnoId === j1Id || turnoId === j1User ? jogo.jogador1Nome : jogo.jogador2Nome).split(" ")[0]} inicia esta rodada...`
              : `Aguardando ${(turnoId === j1Id || turnoId === j1User ? jogo.jogador1Nome : jogo.jogador2Nome).split(" ")[0]} jogar...`}
          </Text>
        </View>
      )}

      {/* Rodapé do Card com Hora */}
      {timestamp ? (
        <View className="mt-1 flex-row items-center justify-end gap-1">
          <Text className="text-[9px] font-mono text-zinc-500">
            {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
