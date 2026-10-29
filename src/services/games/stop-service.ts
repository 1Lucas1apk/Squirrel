import { 
  JogoChatPayload, 
  JogoStopEstado, 
  StopRespostas, 
  StatusValidacaoItem, 
  ValidacaoStop 
} from "../../types/domain";

import stopDictRaw from "../../data/stop-dicionario.json";

export const LETRAS_DISPONIVEIS_STOP: string[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", 
  "L", "M", "N", "O", "P", "R", "S", "T", "U", "V"
];

export const CATEGORIAS_PADRAO_STOP = ["Nome", "Comida", "Objeto", "Cidade / Lugar"];

export function normalizarPalavraStop(t?: string | null): string {
  if (!t) return "";
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

// O(1) Sets indexados para consulta instantânea
const nomesSet = new Set((stopDictRaw.nomes || []).map(w => normalizarPalavraStop(w)));
const comidasSet = new Set((stopDictRaw.comidas || []).map(w => normalizarPalavraStop(w)));
const objetosSet = new Set((stopDictRaw.objetos || []).map(w => normalizarPalavraStop(w)));
const lugaresSet = new Set((stopDictRaw.lugares || []).map(w => normalizarPalavraStop(w)));

export function validarPrimeiraLetraStop(palavra?: string | null, letra?: string | null): boolean {
  if (!palavra || !letra) return false;
  const pNorm = normalizarPalavraStop(palavra);
  const lNorm = normalizarPalavraStop(letra);
  return pNorm.length >= 3 && pNorm.startsWith(lNorm);
}

export interface ResultadoValidacaoStop {
  valido: boolean;
  motivo?: string;
}

/**
 * Validação rigorosa e inteligente da palavra com base na categoria e letra da rodada
 */
export function validarPalavraCategoriaStop(
  categoria: keyof StopRespostas,
  palavra: string | null | undefined,
  letraEsperada: string
): ResultadoValidacaoStop {
  const norm = normalizarPalavraStop(palavra);
  const lNorm = normalizarPalavraStop(letraEsperada);

  if (!norm || norm.length === 0) {
    return { valido: false, motivo: "Em branco" };
  }

  if (norm.length < 3) {
    return { valido: false, motivo: "Mínimo 3 letras" };
  }

  if (!norm.startsWith(lNorm)) {
    return { valido: false, motivo: `Não começa com ${lNorm}` };
  }

  // Impede que o jogador apenas repita a mesma letra (ex: 'EEE', 'AAAA')
  if (/^(.)\1+$/.test(norm)) {
    return { valido: false, motivo: "Letras repetidas" };
  }

  let setCat: Set<string>;
  let nomeCat: string;
  if (categoria === "nome") {
    setCat = nomesSet;
    nomeCat = "nome";
  } else if (categoria === "comida") {
    setCat = comidasSet;
    nomeCat = "comida";
  } else if (categoria === "objeto") {
    setCat = objetosSet;
    nomeCat = "objeto";
  } else {
    setCat = lugaresSet;
    nomeCat = "lugar";
  }

  // 1. Checagem exata no banco de palavras da categoria
  if (setCat.has(norm)) {
    return { valido: true };
  }

  // 2. Variação com plural (ex: ESPELHOS -> ESPELHO, ERVILHAS -> ERVILHA)
  if (norm.endsWith("S") && setCat.has(norm.slice(0, -1))) {
    return { valido: true };
  }
  if (norm.endsWith("ES") && setCat.has(norm.slice(0, -2))) {
    return { valido: true };
  }

  // 3. Detecção de incongruência categórica evidente (ex: ELEFANTE em Comida)
  if (categoria === "comida" && (objetosSet.has(norm) || lugaresSet.has(norm) || nomesSet.has(norm))) {
    return { valido: false, motivo: "Não é comida" };
  }
  if (categoria === "objeto" && (comidasSet.has(norm) || lugaresSet.has(norm) || nomesSet.has(norm))) {
    return { valido: false, motivo: "Não é objeto" };
  }
  if (categoria === "lugar" && (comidasSet.has(norm) || objetosSet.has(norm) || nomesSet.has(norm))) {
    return { valido: false, motivo: "Não é lugar" };
  }
  if (categoria === "nome" && (comidasSet.has(norm) || objetosSet.has(norm))) {
    return { valido: false, motivo: "Não é nome" };
  }

  // Não foi encontrado no léxico da categoria
  return { valido: false, motivo: `Não reconhecido em ${nomeCat}` };
}

export function sortearLetraStop(letraAtual?: string): string {
  const disponiveis = LETRAS_DISPONIVEIS_STOP.filter(l => l !== letraAtual);
  const idx = Math.floor(Math.random() * disponiveis.length);
  return disponiveis[idx] || "A";
}

/**
 * Cria uma nova partida de Stop! Adedonha 1v1
 */
export function criarPartidaStop(
  jogador1Id: string,
  jogador1Nome: string,
  jogador1Username: string | null | undefined,
  jogador2Id: string,
  jogador2Nome: string,
  jogador2Username: string | null | undefined,
  letraInicial?: string
): JogoChatPayload {
  const letraSorteada = letraInicial || sortearLetraStop();

  const estado: JogoStopEstado = {
    letraSorteada,
    categorias: [...CATEGORIAS_PADRAO_STOP],
    fase: "jogando",
    quemParouId: null,
    tempoStopAcionado: null,
    jogador1Respostas: null,
    jogador1Pronto: false,
    jogador2Respostas: null,
    jogador2Pronto: false,
    jogador1Pontos: 0,
    jogador2Pontos: 0,
    validacaoJ1: {
      nome: "pendente",
      comida: "pendente",
      objeto: "pendente",
      lugar: "pendente"
    },
    validacaoJ2: {
      nome: "pendente",
      comida: "pendente",
      objeto: "pendente",
      lugar: "pendente"
    },
    rodada: 1
  };

  return {
    tipo: "stop",
    partidaId: `stop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    jogador1Id,
    jogador1Nome,
    jogador1Username: jogador1Username || null,
    jogador2Id,
    jogador2Nome,
    jogador2Username: jogador2Username || null,
    turnoAtualId: jogador1Id,
    quemIniciouId: jogador1Id,
    estado,
    status: "em_andamento",
    vencedorId: null,
    vencedorNome: null,
    placar: {
      jogador1: 0,
      jogador2: 0,
      empates: 0
    },
    criadoEm: Date.now(),
    atualizadoEm: Date.now()
  };
}

/**
 * Pré-avalia automaticamente as palavras enviadas pelos dois jogadores usando o dicionário
 */
export function gerarAutoValidacaoStop(
  letra: string,
  r1: StopRespostas,
  r2: StopRespostas
): { 
  val1: ValidacaoStop; 
  val2: ValidacaoStop;
  motivos1: Partial<Record<keyof StopRespostas, string>>;
  motivos2: Partial<Record<keyof StopRespostas, string>>;
} {
  const cats: (keyof StopRespostas)[] = ["nome", "comida", "objeto", "lugar"];
  const val1: ValidacaoStop = { nome: "pendente", comida: "pendente", objeto: "pendente", lugar: "pendente" };
  const val2: ValidacaoStop = { nome: "pendente", comida: "pendente", objeto: "pendente", lugar: "pendente" };
  const motivos1: Partial<Record<keyof StopRespostas, string>> = {};
  const motivos2: Partial<Record<keyof StopRespostas, string>> = {};

  for (const cat of cats) {
    const res1 = validarPalavraCategoriaStop(cat, r1[cat], letra);
    const res2 = validarPalavraCategoriaStop(cat, r2[cat], letra);

    if (!res1.valido) {
      val1[cat] = "invalido";
      motivos1[cat] = res1.motivo;
    }
    if (!res2.valido) {
      val2[cat] = "invalido";
      motivos2[cat] = res2.motivo;
    }

    if (res1.valido && res2.valido) {
      const p1 = normalizarPalavraStop(r1[cat]);
      const p2 = normalizarPalavraStop(r2[cat]);
      if (p1 === p2) {
        // Palavras idênticas repetidas valem 5 pontos
        val1[cat] = "repetido";
        val2[cat] = "repetido";
        motivos1[cat] = "Palavra repetida (+5)";
        motivos2[cat] = "Palavra repetida (+5)";
      } else {
        val1[cat] = "valido";
        val2[cat] = "valido";
      }
    } else {
      if (res1.valido) val1[cat] = "valido";
      if (res2.valido) val2[cat] = "valido";
    }
  }

  return { val1, val2, motivos1, motivos2 };
}

/**
 * Submete as respostas de um jogador e pode acionar o STOP
 */
export function submeterRespostasStop(
  payload: JogoChatPayload,
  jogadorId: string,
  respostas: StopRespostas,
  acionouStop: boolean
): { payload: JogoChatPayload; sucesso: boolean; erro?: string } {
  if (payload.tipo !== "stop") {
    return { payload, sucesso: false, erro: "Jogo não é do tipo Stop" };
  }

  const estado = { ...(payload.estado as JogoStopEstado) };
  const isJ1 = jogadorId === payload.jogador1Id;
  const isJ2 = jogadorId === payload.jogador2Id;

  if (!isJ1 && !isJ2) {
    return { payload, sucesso: false, erro: "Você não é participante desta partida" };
  }

  if (isJ1) {
    estado.jogador1Respostas = { ...respostas };
    estado.jogador1Pronto = true;
  } else {
    estado.jogador2Respostas = { ...respostas };
    estado.jogador2Pronto = true;
  }

  // Se acionou o STOP e ainda estava na fase jogando
  if (acionouStop && estado.fase === "jogando") {
    estado.fase = "stop_acionado";
    estado.quemParouId = jogadorId;
    estado.tempoStopAcionado = Date.now();
  }

  // Se ambos entregaram suas respostas, avança para conferência
  if (estado.jogador1Pronto && estado.jogador2Pronto) {
    estado.fase = "conferencia";
    if (estado.jogador1Respostas && estado.jogador2Respostas) {
      const { val1, val2, motivos1, motivos2 } = gerarAutoValidacaoStop(
        estado.letraSorteada,
        estado.jogador1Respostas,
        estado.jogador2Respostas
      );
      estado.validacaoJ1 = val1;
      estado.validacaoJ2 = val2;
      estado.motivosJ1 = motivos1;
      estado.motivosJ2 = motivos2;
    }
  }

  return {
    sucesso: true,
    payload: {
      ...payload,
      estado,
      atualizadoEm: Date.now()
    }
  };
}

/**
 * Alterna a validação manual de uma palavra na fase de conferência
 */
export function alternarValidacaoItemStop(
  payload: JogoChatPayload,
  alvoJogador: "j1" | "j2",
  categoria: keyof ValidacaoStop,
  novoStatus?: StatusValidacaoItem
): { payload: JogoChatPayload; sucesso: boolean } {
  if (payload.tipo !== "stop") return { payload, sucesso: false };

  const estado = { ...(payload.estado as JogoStopEstado) };
  const validacao = alvoJogador === "j1" 
    ? { ...(estado.validacaoJ1 || { nome: "pendente", comida: "pendente", objeto: "pendente", lugar: "pendente" }) }
    : { ...(estado.validacaoJ2 || { nome: "pendente", comida: "pendente", objeto: "pendente", lugar: "pendente" }) };

  if (novoStatus) {
    validacao[categoria] = novoStatus;
  } else {
    // Ciclo: valido (10) -> repetido (5) -> invalido (0) -> valido (10)
    const atual = validacao[categoria];
    if (atual === "valido") validacao[categoria] = "repetido";
    else if (atual === "repetido") validacao[categoria] = "invalido";
    else validacao[categoria] = "valido";
  }

  if (alvoJogador === "j1") estado.validacaoJ1 = validacao;
  else estado.validacaoJ2 = validacao;

  return {
    sucesso: true,
    payload: {
      ...payload,
      estado,
      atualizadoEm: Date.now()
    }
  };
}

/**
 * Finaliza a rodada, calcula pontuação e define o vencedor
 */
export function finalizarRodadaStop(
  payload: JogoChatPayload
): { payload: JogoChatPayload; sucesso: boolean } {
  if (payload.tipo !== "stop") return { payload, sucesso: false };

  const estado = { ...(payload.estado as JogoStopEstado) };
  const cats: (keyof ValidacaoStop)[] = ["nome", "comida", "objeto", "lugar"];

  const calcPontos = (val?: ValidacaoStop | null) => {
    if (!val) return 0;
    let total = 0;
    for (const c of cats) {
      if (val[c] === "valido") total += 10;
      else if (val[c] === "repetido") total += 5;
    }
    return total;
  };

  const p1 = calcPontos(estado.validacaoJ1);
  const p2 = calcPontos(estado.validacaoJ2);

  estado.jogador1Pontos = p1;
  estado.jogador2Pontos = p2;
  estado.fase = "finalizado";

  let status: "vitoria" | "empate" = "empate";
  let vencedorId: string | null = null;
  let vencedorNome: string | null = null;

  const placar = { ...(payload.placar || { jogador1: 0, jogador2: 0, empates: 0 }) };

  if (p1 > p2) {
    status = "vitoria";
    vencedorId = payload.jogador1Id;
    vencedorNome = payload.jogador1Nome;
    placar.jogador1 = (placar.jogador1 || 0) + 1;
  } else if (p2 > p1) {
    status = "vitoria";
    vencedorId = payload.jogador2Id;
    vencedorNome = payload.jogador2Nome;
    placar.jogador2 = (placar.jogador2 || 0) + 1;
  } else {
    status = "empate";
    placar.empates = (placar.empates || 0) + 1;
  }

  return {
    sucesso: true,
    payload: {
      ...payload,
      estado,
      status,
      vencedorId,
      vencedorNome,
      placar,
      atualizadoEm: Date.now()
    }
  };
}

/**
 * Reinicia o Stop mantendo o placar acumulado e sorteando nova letra
 */
export function reiniciarPartidaStop(
  payload: JogoChatPayload,
  quemIniciaId?: string
): JogoChatPayload {
  const estadoAntigo = payload.estado as JogoStopEstado;
  const novaLetra = sortearLetraStop(estadoAntigo.letraSorteada);

  const novoEstado: JogoStopEstado = {
    letraSorteada: novaLetra,
    categorias: [...CATEGORIAS_PADRAO_STOP],
    fase: "jogando",
    quemParouId: null,
    tempoStopAcionado: null,
    jogador1Respostas: null,
    jogador1Pronto: false,
    jogador2Respostas: null,
    jogador2Pronto: false,
    jogador1Pontos: 0,
    jogador2Pontos: 0,
    validacaoJ1: {
      nome: "pendente",
      comida: "pendente",
      objeto: "pendente",
      lugar: "pendente"
    },
    validacaoJ2: {
      nome: "pendente",
      comida: "pendente",
      objeto: "pendente",
      lugar: "pendente"
    },
    motivosJ1: undefined,
    motivosJ2: undefined,
    rodada: (estadoAntigo.rodada || 1) + 1
  };

  return {
    ...payload,
    turnoAtualId: quemIniciaId || payload.jogador1Id,
    quemIniciouId: quemIniciaId || payload.jogador1Id,
    estado: novoEstado,
    status: "em_andamento",
    vencedorId: null,
    vencedorNome: null,
    atualizadoEm: Date.now()
  };
}
