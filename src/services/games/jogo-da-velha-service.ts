import { JogoChatPayload, JogoVelhaEstado } from "../../types/domain";

export const LINHAS_VITORIA = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function criarPartidaJogoDaVelha(
  jogador1Id: string,
  jogador1Nome: string,
  jogador1Username: string | undefined | null,
  jogador2Id: string,
  jogador2Nome: string,
  jogador2Username: string | undefined | null,
  quemComecaId?: string
): JogoChatPayload {
  const agora = Date.now();
  const primeiroId = quemComecaId || jogador1Id;
  const estado: JogoVelhaEstado = {
    tabuleiro: Array(9).fill(null),
    linhasVencedoras: null,
  };

  return {
    tipo: "velha",
    partidaId: `velha_${agora}_${Math.random().toString(36).substring(2, 6)}`,
    jogador1Id,
    jogador1Nome,
    jogador1Username: jogador1Username ? jogador1Username.replace(/^@/, "") : null,
    jogador2Id,
    jogador2Nome,
    jogador2Username: jogador2Username ? jogador2Username.replace(/^@/, "") : null,
    turnoAtualId: primeiroId, // Quem começa a partida
    quemIniciouId: primeiroId,
    estado,
    status: "em_andamento",
    vencedorId: null,
    vencedorNome: null,
    placar: {
      jogador1: 0,
      jogador2: 0,
      empates: 0,
    },
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export function processarJogadaVelha(
  payload: JogoChatPayload,
  posicao: number,
  jogadorId: string,
  jogadorUsername?: string
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi finalizada." };
  }

  const estado = { ...(payload.estado as JogoVelhaEstado) };
  const tabuleiro = [...estado.tabuleiro];

  if (posicao < 0 || posicao > 8 || tabuleiro[posicao] !== null) {
    return { sucesso: false, erro: "Esta casa já está ocupada." };
  }

  // Identificação do jogador (por UID ou por @username)
  const cleanId = (jogadorId || "").toLowerCase().trim();
  const cleanUser = (jogadorUsername || "").toLowerCase().replace(/^@/, "").trim();

  const j1Id = (payload.jogador1Id || "").toLowerCase().trim();
  const j1User = (payload.jogador1Username || "").toLowerCase().replace(/^@/, "").trim();

  const j2Id = (payload.jogador2Id || "").toLowerCase().trim();
  const j2User = (payload.jogador2Username || "").toLowerCase().replace(/^@/, "").trim();

  const isJogador1 = (cleanId && j1Id === cleanId) || (cleanUser && (j1Id === cleanUser || j1User === cleanUser));
  const isJogador2 = (cleanId && j2Id === cleanId) || (cleanUser && (j2Id === cleanUser || j2User === cleanUser));

  if (!isJogador1 && !isJogador2) {
    return { sucesso: false, erro: "Você não é um dos participantes desta partida." };
  }

  // Validação de Turno
  const turnoId = (payload.turnoAtualId || "").toLowerCase().trim();
  const isMeuTurno = 
    (isJogador1 && (turnoId === j1Id || turnoId === j1User)) ||
    (isJogador2 && (turnoId === j2Id || turnoId === j2User));

  if (!isMeuTurno) {
    return { sucesso: false, erro: "Aguarde a vez do outro jogador!" };
  }

  const simbolo = isJogador1 ? "X" : "O";
  tabuleiro[posicao] = simbolo;

  // Checagem de Vitória
  let linhaVencedora: number[] | null = null;
  for (const linha of LINHAS_VITORIA) {
    const [a, b, c] = linha;
    if (tabuleiro[a] && tabuleiro[a] === tabuleiro[b] && tabuleiro[a] === tabuleiro[c]) {
      linhaVencedora = linha;
      break;
    }
  }

  const placar = {
    jogador1: payload.placar?.jogador1 ?? 0,
    jogador2: payload.placar?.jogador2 ?? 0,
    empates: payload.placar?.empates ?? 0,
  };

  let status: "em_andamento" | "vitoria" | "empate" = "em_andamento";
  let vencedorId: string | null = null;
  let vencedorNome: string | null = null;
  let proximoTurnoId = isJogador1 ? payload.jogador2Id : payload.jogador1Id;

  if (linhaVencedora) {
    status = "vitoria";
    vencedorId = isJogador1 ? payload.jogador1Id : payload.jogador2Id;
    vencedorNome = isJogador1 ? payload.jogador1Nome : payload.jogador2Nome;
    if (isJogador1) placar.jogador1 += 1;
    else placar.jogador2 += 1;
  } else if (!tabuleiro.includes(null)) {
    status = "empate";
    placar.empates += 1;
  }

  const novoEstado: JogoVelhaEstado = {
    tabuleiro,
    linhasVencedoras: linhaVencedora,
  };

  const novoPayload: JogoChatPayload = {
    ...payload,
    turnoAtualId: proximoTurnoId,
    estado: novoEstado,
    status,
    vencedorId,
    vencedorNome,
    placar,
    atualizadoEm: Date.now(),
  };

  return { sucesso: true, novoPayload };
}

export function reiniciarPartidaVelha(payloadAntigo: JogoChatPayload): JogoChatPayload {
  const agora = Date.now();
  const estado: JogoVelhaEstado = {
    tabuleiro: Array(9).fill(null),
    linhasVencedoras: null,
  };

  // Revezamento Justo 1 a 1:
  // Descobre quem iniciou a partida anterior e passa a vez de começar para o outro jogador.
  const j1Id = payloadAntigo.jogador1Id;
  const j2Id = payloadAntigo.jogador2Id;
  const ultimoIniciador = payloadAntigo.quemIniciouId || j1Id;
  const novoQueComecaId = (ultimoIniciador === j1Id) ? j2Id : j1Id;

  return {
    ...payloadAntigo,
    partidaId: `velha_${agora}_${Math.random().toString(36).substring(2, 6)}`,
    quemIniciouId: novoQueComecaId,
    turnoAtualId: novoQueComecaId,
    estado,
    status: "em_andamento",
    vencedorId: null,
    vencedorNome: null,
    atualizadoEm: agora,
  };
}
