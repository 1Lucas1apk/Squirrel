import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Anchor, RotateCcw, Target, Crosshair, Shield } from "lucide-react-native";
import { JogoChatPayload, JogoBatalhaNavalEstado } from "../../../types/domain";
import {
  GRID_SIZE,
  TOTAL_CELULAS,
  TOTAL_NAVIOS_CELULAS,
  getCoordLabel,
} from "../../../services/games/batalha-naval-service";

interface BatalhaNavalCardProps {
  jogo: JogoChatPayload;
  mensagemId: string;
  myUserId: string;
  myUsername: string;
  onDisparar: (index: number) => void;
  onReiniciar: () => void;
  timestamp?: number;
  isMe?: boolean;
}

export const BatalhaNavalCard: React.FC<BatalhaNavalCardProps> = ({
  jogo,
  myUserId,
  myUsername,
  onDisparar,
  onReiniciar,
  timestamp,
  isMe,
}) => {
  const estado = jogo.estado as JogoBatalhaNavalEstado;
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

  // Radar: tiros que EU dei no inimigo
  const meusTiros = isJogador1 ? (estado?.jogador1Tiros || []) : (estado?.jogador2Tiros || []);
  const frotaInimiga = isJogador1 ? (estado?.jogador2Frota || []) : (estado?.jogador1Frota || []);

  // Minha frota e tiros que o INIMIGO deu em mim
  const minhaFrota = isJogador1 ? (estado?.jogador1Frota || []) : (estado?.jogador2Frota || []);
  const tirosInimigos = isJogador1 ? (estado?.jogador2Tiros || []) : (estado?.jogador1Tiros || []);

  // Estatísticas de combate
  const acertosMeus = meusTiros.filter(idx => frotaInimiga.includes(idx)).length;
  const perdasMinhas = tirosInimigos.filter(idx => minhaFrota.includes(idx)).length;
  const naviosMeusRestantes = TOTAL_NAVIOS_CELULAS - perdasMinhas;

  const handleDispararPress = (cellIndex: number) => {
    if (!isMeuTurno) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (meusTiros.includes(cellIndex)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDisparar(cellIndex);
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
    statusBadgeBg = isVencedorEu ? "bg-amber-500/20 border-amber-500/50" : "bg-cyan-500/20 border-cyan-500/50";
    statusBadgeText = isVencedorEu ? "👑 Vitória Naval!" : `🏆 Vitória de ${jogo.vencedorNome || "Adversário"}`;
    statusTextColor = isVencedorEu ? "text-amber-300" : "text-cyan-300";
  } else if (isMeuTurno) {
    statusBadgeBg = "bg-emerald-500/20 border-emerald-500/50";
    statusBadgeText = "🟢 Mirar Canhão";
    statusTextColor = "text-emerald-300";
  } else {
    const nomeVez = (turnoId === j1Id || turnoId === j1User) ? jogo.jogador1Nome : jogo.jogador2Nome;
    statusBadgeBg = "bg-cyan-500/15 border-cyan-500/30";
    statusBadgeText = `⏳ Vez de ${nomeVez.split(" ")[0]}`;
    statusTextColor = "text-cyan-300";
  }

  const p1NomeCurto = (jogo.jogador1Nome || "Almirante 1").split(" ")[0];
  const p2NomeCurto = (jogo.jogador2Nome || "Almirante 2").split(" ")[0];
  const isRadarVazio = meusTiros.length === 0;

  return (
    <View className="my-1 w-[260px] self-center rounded-2xl bg-[#060a12] border border-cyan-500/30 p-2.5 shadow-xl">
      {/* Cabeçalho Naval */}
      <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
        <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-1">
          <Anchor size={14} color="#38bdf8" />
          <Text className="text-[10px] font-black uppercase tracking-wider text-cyan-300 truncate">
            Batalha Naval
          </Text>
        </View>

        <View className={`px-2 py-0.5 rounded-full border ${statusBadgeBg}`}>
          <Text className={`text-[9px] font-bold ${statusTextColor}`}>
            {statusBadgeText}
          </Text>
        </View>
      </View>

      {/* Placar Acumulado */}
      <View className="flex-row items-center justify-between px-2 py-1 my-1.5 bg-[#03060a] rounded-lg border border-cyan-950/60">
        <View className="items-center flex-1">
          <Text className="text-[8.5px] uppercase font-bold text-cyan-400 truncate max-w-[65px]" numberOfLines={1}>
            ⚓ {p1NomeCurto}
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
          <Text className="text-[8.5px] uppercase font-bold text-sky-400 truncate max-w-[65px]" numberOfLines={1}>
            ⚓ {p2NomeCurto}
          </Text>
          <Text className="text-xs font-black text-white">
            {jogo.placar?.jogador2 ?? 0}
          </Text>
        </View>
      </View>

      {/* Barra Tática de Combate */}
      <View className="flex-row items-center justify-between px-2 py-1 mb-1.5 bg-cyan-950/20 rounded-md border border-cyan-900/40">
        <View className="flex-row items-center gap-1">
          <Target size={11} color="#38bdf8" />
          <Text className="text-[9px] font-bold text-cyan-300">
            Alvos: {acertosMeus}/{TOTAL_NAVIOS_CELULAS}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Shield size={11} color="#34d399" />
          <Text className="text-[9px] font-bold text-emerald-300">
            Frota: {naviosMeusRestantes}/{TOTAL_NAVIOS_CELULAS}
          </Text>
        </View>
      </View>

      {/* Radar de Sonar 5x5 */}
      <View className="bg-[#0b1326] border-2 border-cyan-500/40 rounded-xl p-1.5 shadow-inner">
        {Array.from({ length: GRID_SIZE }).map((_, r) => (
          <View key={`radar-row-${r}`} className="flex-row justify-between my-0.5">
            {Array.from({ length: GRID_SIZE }).map((_, c) => {
              const idx = r * GRID_SIZE + c;
              const isDisparado = meusTiros.includes(idx);
              const isAcerto = isDisparado && frotaInimiga.includes(idx);
              const isAgua = isDisparado && !frotaInimiga.includes(idx);
              const isUltimoTiro = estado?.ultimoTiro?.index === idx;

              return (
                <Pressable
                  key={`radar-cell-${idx}`}
                  onPress={() => handleDispararPress(idx)}
                  disabled={!isMeuTurno || isDisparado || jogo.status !== "em_andamento"}
                  className={`w-[42px] h-[40px] rounded-lg items-center justify-center border ${
                    isAcerto
                      ? "bg-rose-950/90 border-rose-500 shadow-md shadow-rose-500/40"
                      : isAgua
                      ? "bg-cyan-950/30 border-cyan-900/40 opacity-70"
                      : isMeuTurno && jogo.status === "em_andamento"
                      ? "bg-[#0d1b33] border-cyan-700/60 active:bg-cyan-600/40 active:scale-95"
                      : "bg-[#08101e] border-cyan-950/60"
                  }`}
                >
                  {isAcerto ? (
                    <Text className="text-base">💥</Text>
                  ) : isAgua ? (
                    <Text className="text-xs">⚪</Text>
                  ) : (
                    <View className="items-center justify-center">
                      <Text className="text-[9.5px] font-mono font-bold text-cyan-400/80">
                        {getCoordLabel(idx)}
                      </Text>
                      {isMeuTurno && jogo.status === "em_andamento" && (
                        <Crosshair size={8} color="#38bdf8" />
                      )}
                    </View>
                  )}
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
          className="mt-2.5 w-full py-2 rounded-xl bg-cyan-600 border border-cyan-400/40 flex-row items-center justify-center gap-1.5 active:scale-95 shadow"
        >
          <RotateCcw size={12} color="#ffffff" />
          <Text className="text-[11px] font-black uppercase text-white tracking-wider">
            Revanche Naval
          </Text>
        </Pressable>
      ) : isMeuTurno ? (
        <View className="mt-1.5 flex-row items-center justify-center gap-1 py-0.5">
          <Target size={10} color="#34d399" />
          <Text className="text-[9.5px] font-bold text-emerald-400">
            {isRadarVazio ? "Você abre o fogo! Escolha uma coordenada." : "Sua vez! Toque no radar para disparar."}
          </Text>
        </View>
      ) : (
        <View className="mt-1.5 flex-row items-center justify-center gap-1 py-0.5">
          <Text className="text-[9.5px] font-bold text-zinc-500">
            {isRadarVazio
              ? `${(turnoId === j1Id || turnoId === j1User ? jogo.jogador1Nome : jogo.jogador2Nome).split(" ")[0]} abre o fogo naval...`
              : `Aguardando ${(turnoId === j1Id || turnoId === j1User ? jogo.jogador1Nome : jogo.jogador2Nome).split(" ")[0]} disparar...`}
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
