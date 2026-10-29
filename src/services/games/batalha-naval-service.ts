import { JogoChatPayload, JogoBatalhaNavalEstado } from "../../types/domain";

export const GRID_SIZE = 5; // 5x5 = 25 células
export const TOTAL_CELULAS = GRID_SIZE * GRID_SIZE; // 25
export const TOTAL_NAVIOS_CELULAS = 7; // 3 + 2 + 2 = 7

export const getIndex = (r: number, c: number): number => r * GRID_SIZE + c;
export const getRow = (i: number): number => Math.floor(i / GRID_SIZE);
export const getCol = (i: number): number => i % GRID_SIZE;

export const getCoordLabel = (index: number): string => {
  const rowLetter = String.fromCharCode(65 + getRow(index)); // A, B, C, D, E
  const colNum = getCol(index) + 1; // 1, 2, 3, 4, 5
  return `${rowLetter}${colNum}`;
};

/**
 * Posiciona 3 navios (tamanhos 3, 2, 2) sem sobreposição em uma grade 5x5
 */
export function gerarFrotaAleatoria(): number[] {
  const naviosTamanhos = [3, 2, 2];
  const celulasOcupadas = new Set<number>();

  for (const tamanho of naviosTamanhos) {
    let colocado = false;
    let tentativas = 0;

    while (!colocado && tentativas < 100) {
      tentativas++;
      const isHorizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (isHorizontal ? GRID_SIZE : GRID_SIZE - tamanho + 1));
      const c = Math.floor(Math.random() * (isHorizontal ? GRID_SIZE - tamanho + 1 : GRID_SIZE));

      const indicesNavio: number[] = [];
      for (let i = 0; i < tamanho; i++) {
        const curR = isHorizontal ? r : r + i;
        const curC = isHorizontal ? c + i : c;
        indicesNavio.push(getIndex(curR, curC));
      }

      // Verifica se alguma célula já está ocupada
      const colide = indicesNavio.some(idx => celulasOcupadas.has(idx));
      if (!colide) {
        indicesNavio.forEach(idx => celulasOcupadas.add(idx));
        colocado = true;
      }
    }
  }

  // Se por acaso exceder tentativas, preenche com posições seguras padrão
  if (celulasOcupadas.size !== TOTAL_NAVIOS_CELULAS) {
    return [0, 1, 2, 6, 11, 18, 19];
  }

  return Array.from(celulasOcupadas).sort((a, b) => a - b);
}

export function criarPartidaBatalhaNaval(
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

  const estado: JogoBatalhaNavalEstado = {
    jogador1Frota: gerarFrotaAleatoria(),
    jogador2Frota: gerarFrotaAleatoria(),
    jogador1Tiros: [],
    jogador2Tiros: [],
    ultimoTiro: null,
  };

  return {
    tipo: "batalha_naval",
    partidaId: `naval_${agora}_${Math.random().toString(36).substring(2, 6)}`,
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

export function processarTiroBatalhaNaval(
  payload: JogoChatPayload,
  tiroIndex: number,
  jogadorId: string,
  jogadorUsername?: string
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta batalha já foi finalizada." };
  }

  if (tiroIndex < 0 || tiroIndex >= TOTAL_CELULAS) {
    return { sucesso: false, erro: "Coordenada fora do radar." };
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
    return { sucesso: false, erro: "Você não é participante desta batalha." };
  }

  // Validação de Turno
  const turnoId = (payload.turnoAtualId || "").toLowerCase().trim();
  const isMeuTurno =
    (isJogador1 && (turnoId === j1Id || turnoId === j1User)) ||
    (isJogador2 && (turnoId === j2Id || turnoId === j2User));

  if (!isMeuTurno) {
    return { sucesso: false, erro: "Aguarde o disparo do outro almirante!" };
  }

  const estadoAtual = payload.estado as JogoBatalhaNavalEstado;
  const meusTiros = isJogador1 ? [...estadoAtual.jogador1Tiros] : [...estadoAtual.jogador2Tiros];
  const frotaInimiga = isJogador1 ? estadoAtual.jogador2Frota : estadoAtual.jogador1Frota;

  // Não pode disparar duas vezes na mesma coordenada
  if (meusTiros.includes(tiroIndex)) {
    return { sucesso: false, erro: "Você já disparou nesta coordenada!" };
  }

  meusTiros.push(tiroIndex);
  const acertou = frotaInimiga.includes(tiroIndex);

  // Checagem de Vitória: todos os 7 pedaços da frota inimiga foram atingidos?
  const afundouTodos = frotaInimiga.every(idx => meusTiros.includes(idx));

  const placar = {
    jogador1: payload.placar?.jogador1 ?? 0,
    jogador2: payload.placar?.jogador2 ?? 0,
    empates: payload.placar?.empates ?? 0,
  };

  let status: "em_andamento" | "vitoria" | "empate" = "em_andamento";
  let vencedorId: string | null = null;
  let vencedorNome: string | null = null;
  let proximoTurnoId = isJogador1 ? payload.jogador2Id : payload.jogador1Id;

  if (afundouTodos) {
    status = "vitoria";
    vencedorId = isJogador1 ? payload.jogador1Id : payload.jogador2Id;
    vencedorNome = isJogador1 ? payload.jogador1Nome : payload.jogador2Nome;
    if (isJogador1) placar.jogador1 += 1;
    else placar.jogador2 += 1;
  }

  const novoEstado: JogoBatalhaNavalEstado = {
    jogador1Frota: estadoAtual.jogador1Frota,
    jogador2Frota: estadoAtual.jogador2Frota,
    jogador1Tiros: isJogador1 ? meusTiros : estadoAtual.jogador1Tiros,
    jogador2Tiros: isJogador2 ? meusTiros : estadoAtual.jogador2Tiros,
    ultimoTiro: {
      jogadorId: isJogador1 ? payload.jogador1Id : payload.jogador2Id,
      index: tiroIndex,
      acertou,
    },
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

export function reiniciarPartidaBatalhaNaval(payloadAntigo: JogoChatPayload): JogoChatPayload {
  const agora = Date.now();

  const estado: JogoBatalhaNavalEstado = {
    jogador1Frota: gerarFrotaAleatoria(),
    jogador2Frota: gerarFrotaAleatoria(),
    jogador1Tiros: [],
    jogador2Tiros: [],
    ultimoTiro: null,
  };

  // Revezamento Justo 1 a 1:
  const j1Id = payloadAntigo.jogador1Id;
  const j2Id = payloadAntigo.jogador2Id;
  const ultimoIniciador = payloadAntigo.quemIniciouId || j1Id;
  const novoQueComecaId = ultimoIniciador === j1Id ? j2Id : j1Id;

  return {
    ...payloadAntigo,
    partidaId: `naval_${agora}_${Math.random().toString(36).substring(2, 6)}`,
    quemIniciouId: novoQueComecaId,
    turnoAtualId: novoQueComecaId,
    estado,
    status: "em_andamento",
    vencedorId: null,
    vencedorNome: null,
    atualizadoEm: agora,
  };
}
