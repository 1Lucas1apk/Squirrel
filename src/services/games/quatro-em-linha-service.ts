import { JogoChatPayload, JogoQuatroLinhaEstado } from "../../types/domain";

export const NUM_LINHAS = 6;
export const NUM_COLUNAS = 7;
export const TOTAL_CELULAS = NUM_LINHAS * NUM_COLUNAS; // 42

export const getIndex = (r: number, c: number): number => r * NUM_COLUNAS + c;
export const getRow = (i: number): number => Math.floor(i / NUM_COLUNAS);
export const getCol = (i: number): number => i % NUM_COLUNAS;

export function criarPartidaQuatroEmLinha(
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

  // Tabuleiro plano 1D de 42 posições (compatível com Firestore sem matriz aninhada)
  const tabuleiro: (string | null)[] = Array(TOTAL_CELULAS).fill(null);

  const estado: JogoQuatroLinhaEstado = {
    tabuleiro,
    linhasVencedoras: null,
    ultimaJogada: null,
  };

  return {
    tipo: "quatro_linha",
    partidaId: `quatro_${agora}_${Math.random().toString(36).substring(2, 6)}`,
    jogador1Id,
    jogador1Nome,
    jogador1Username: jogador1Username ? jogador1Username.replace(/^@/, "") : null,
    jogador2Id,
    jogador2Nome,
    jogador2Username: jogador2Username ? jogador2Username.replace(/^@/, "") : null,
    turnoAtualId: primeiroId,
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

export function verificarVitoriaQuatroLinha(
  tabuleiro: (string | null)[]
): number[] | null {
  // 1. Checagem Horizontal (—)
  for (let r = 0; r < NUM_LINHAS; r++) {
    for (let c = 0; c <= NUM_COLUNAS - 4; c++) {
      const idx = getIndex(r, c);
      const chip = tabuleiro[idx];
      if (
        chip &&
        chip === tabuleiro[getIndex(r, c + 1)] &&
        chip === tabuleiro[getIndex(r, c + 2)] &&
        chip === tabuleiro[getIndex(r, c + 3)]
      ) {
        return [idx, getIndex(r, c + 1), getIndex(r, c + 2), getIndex(r, c + 3)];
      }
    }
  }

  // 2. Checagem Vertical (|)
  for (let r = 0; r <= NUM_LINHAS - 4; r++) {
    for (let c = 0; c < NUM_COLUNAS; c++) {
      const idx = getIndex(r, c);
      const chip = tabuleiro[idx];
      if (
        chip &&
        chip === tabuleiro[getIndex(r + 1, c)] &&
        chip === tabuleiro[getIndex(r + 2, c)] &&
        chip === tabuleiro[getIndex(r + 3, c)]
      ) {
        return [idx, getIndex(r + 1, c), getIndex(r + 2, c), getIndex(r + 3, c)];
      }
    }
  }

  // 3. Checagem Diagonal Descendente (\)
  for (let r = 0; r <= NUM_LINHAS - 4; r++) {
    for (let c = 0; c <= NUM_COLUNAS - 4; c++) {
      const idx = getIndex(r, c);
      const chip = tabuleiro[idx];
      if (
        chip &&
        chip === tabuleiro[getIndex(r + 1, c + 1)] &&
        chip === tabuleiro[getIndex(r + 2, c + 2)] &&
        chip === tabuleiro[getIndex(r + 3, c + 3)]
      ) {
        return [idx, getIndex(r + 1, c + 1), getIndex(r + 2, c + 2), getIndex(r + 3, c + 3)];
      }
    }
  }

  // 4. Checagem Diagonal Ascendente (/)
  for (let r = 3; r < NUM_LINHAS; r++) {
    for (let c = 0; c <= NUM_COLUNAS - 4; c++) {
      const idx = getIndex(r, c);
      const chip = tabuleiro[idx];
      if (
        chip &&
        chip === tabuleiro[getIndex(r - 1, c + 1)] &&
        chip === tabuleiro[getIndex(r - 2, c + 2)] &&
        chip === tabuleiro[getIndex(r - 3, c + 3)]
      ) {
        return [idx, getIndex(r - 1, c + 1), getIndex(r - 2, c + 2), getIndex(r - 3, c + 3)];
      }
    }
  }

  return null;
}

export function processarJogadaQuatroLinha(
  payload: JogoChatPayload,
  coluna: number,
  jogadorId: string,
  jogadorUsername?: string
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi finalizada." };
  }

  if (coluna < 0 || coluna >= NUM_COLUNAS) {
    return { sucesso: false, erro: "Coluna inválida." };
  }

  // Validação de jogador (por UID ou por @username)
  const cleanId = (jogadorId || "").toLowerCase().trim();
  const cleanUser = (jogadorUsername || "").toLowerCase().replace(/^@/, "").trim();

  const j1Id = (payload.jogador1Id || "").toLowerCase().trim();
  const j1User = (payload.jogador1Username || "").toLowerCase().replace(/^@/, "").trim();

  const j2Id = (payload.jogador2Id || "").toLowerCase().trim();
  const j2User = (payload.jogador2Username || "").toLowerCase().replace(/^@/, "").trim();

  const isJogador1 = (cleanId && j1Id === cleanId) || (cleanUser && (j1Id === cleanUser || j1User === cleanUser));
  const isJogador2 = (cleanId && j2Id === cleanId) || (cleanUser && (j2Id === cleanUser || j2User === cleanUser));

  if (!isJogador1 && !isJogador2) {
    return { sucesso: false, erro: "Você não é participante desta partida." };
  }

  // Validação de Turno
  const turnoId = (payload.turnoAtualId || "").toLowerCase().trim();
  const isMeuTurno =
    (isJogador1 && (turnoId === j1Id || turnoId === j1User)) ||
    (isJogador2 && (turnoId === j2Id || turnoId === j2User));

  if (!isMeuTurno) {
    return { sucesso: false, erro: "Aguarde a vez do outro jogador!" };
  }

  const estadoAtual = payload.estado as JogoQuatroLinhaEstado;
  const novoTabuleiro = [...estadoAtual.tabuleiro];

  // Gravidade: Encontrar a linha mais baixa vazia na coluna escolhida (da linha 5 até a 0)
  let linhaDestino = -1;
  for (let r = NUM_LINHAS - 1; r >= 0; r--) {
    const idx = getIndex(r, coluna);
    if (novoTabuleiro[idx] === null) {
      linhaDestino = r;
      break;
    }
  }

  if (linhaDestino === -1) {
    return { sucesso: false, erro: "Esta coluna já está cheia! Escolha outra." };
  }

  const indexDestino = getIndex(linhaDestino, coluna);

  // J1 = "R" (Vermelho), J2 = "Y" (Amarelo)
  const simbolo = isJogador1 ? "R" : "Y";
  novoTabuleiro[indexDestino] = simbolo;

  // Checagem de Vitória
  const linhasVencedoras = verificarVitoriaQuatroLinha(novoTabuleiro);

  const placar = {
    jogador1: payload.placar?.jogador1 ?? 0,
    jogador2: payload.placar?.jogador2 ?? 0,
    empates: payload.placar?.empates ?? 0,
  };

  let status: "em_andamento" | "vitoria" | "empate" = "em_andamento";
  let vencedorId: string | null = null;
  let vencedorNome: string | null = null;
  let proximoTurnoId = isJogador1 ? payload.jogador2Id : payload.jogador1Id;

  if (linhasVencedoras) {
    status = "vitoria";
    vencedorId = isJogador1 ? payload.jogador1Id : payload.jogador2Id;
    vencedorNome = isJogador1 ? payload.jogador1Nome : payload.jogador2Nome;
    if (isJogador1) placar.jogador1 += 1;
    else placar.jogador2 += 1;
  } else {
    // Checagem de empate: a linha 0 de todas as colunas está cheia?
    const isEmpate = Array.from({ length: NUM_COLUNAS }).every((_, c) => novoTabuleiro[getIndex(0, c)] !== null);
    if (isEmpate) {
      status = "empate";
      placar.empates += 1;
    }
  }

  const novoEstado: JogoQuatroLinhaEstado = {
    tabuleiro: novoTabuleiro,
    linhasVencedoras: linhasVencedoras || null,
    ultimaJogada: indexDestino,
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

export function reiniciarPartidaQuatroEmLinha(payloadAntigo: JogoChatPayload): JogoChatPayload {
  const agora = Date.now();
  const tabuleiro: (string | null)[] = Array(TOTAL_CELULAS).fill(null);

  const estado: JogoQuatroLinhaEstado = {
    tabuleiro,
    linhasVencedoras: null,
    ultimaJogada: null,
  };

  // Revezamento Justo 1 a 1:
  const j1Id = payloadAntigo.jogador1Id;
  const j2Id = payloadAntigo.jogador2Id;
  const ultimoIniciador = payloadAntigo.quemIniciouId || j1Id;
  const novoQueComecaId = ultimoIniciador === j1Id ? j2Id : j1Id;

  return {
    ...payloadAntigo,
    partidaId: `quatro_${agora}_${Math.random().toString(36).substring(2, 6)}`,
    quemIniciouId: novoQueComecaId,
    turnoAtualId: novoQueComecaId,
    estado,
    status: "em_andamento",
    vencedorId: null,
    vencedorNome: null,
    atualizadoEm: agora,
  };
}
