import { JogoChatPayload, JogoTermoEstado, PalpiteTermo, StatusLetraTermo } from "../../types/domain";

export const MAX_TENTATIVAS = 6;
export const TAMANHO_PALAVRA = 5;

import { 
  normalizarTermoWord, 
  normalizarTermoWord as normalizarPalavra, 
  sortearPalavraTermo, 
  isPalavraValidaDicionario 
} from "./termo-words-service";

export { 
  normalizarPalavra, 
  sortearPalavraTermo, 
  isPalavraValidaDicionario 
};


/**
 * Algoritmo Oficial do Wordle/Termo para avaliação de 5 letras:
 * 1ª Passagem: Marca todos os "correto" (verdes) exatos.
 * 2ª Passagem: Marca os "presente" (amarelos) respeitando a contagem de letras restantes.
 */
export function avaliarPalpite(palpite: string, palavraSecreta: string): StatusLetraTermo[] {
  const p = normalizarPalavra(palpite);
  const s = normalizarPalavra(palavraSecreta);
  const resultado: StatusLetraTermo[] = new Array(TAMANHO_PALAVRA).fill("ausente");

  const letrasSecretasDisponiveis: (string | null)[] = s.split("");

  // 1ª Passagem: Acertos exatos (Verde)
  for (let i = 0; i < TAMANHO_PALAVRA; i++) {
    if (p[i] === s[i]) {
      resultado[i] = "correto";
      letrasSecretasDisponiveis[i] = null; // Letra consumida
    }
  }

  // 2ª Passagem: Letras presentes em outra posição (Amarelo)
  for (let i = 0; i < TAMANHO_PALAVRA; i++) {
    if (resultado[i] === "correto") continue;

    const letra = p[i];
    const indexNaSecreta = letrasSecretasDisponiveis.indexOf(letra);
    if (indexNaSecreta !== -1) {
      resultado[i] = "presente";
      letrasSecretasDisponiveis[indexNaSecreta] = null; // Letra consumida
    } else {
      resultado[i] = "ausente";
    }
  }

  return resultado;
}

/**
 * Cria uma nova partida de Termo Versus
 */
export function criarPartidaTermo(
  jogador1Id: string,
  jogador1Nome: string,
  jogador1Username: string | undefined | null,
  jogador2Id: string,
  jogador2Nome: string,
  jogador2Username: string | undefined | null,
  customPalavra?: string,
  customDica?: string
): JogoChatPayload {
  const agora = Date.now();
  const modo = customPalavra && customPalavra.trim().length === TAMANHO_PALAVRA ? "desafio" : "aleatorio";
  const palavraSecreta = modo === "desafio" ? normalizarPalavra(customPalavra!) : sortearPalavraTermo();

  const estado: JogoTermoEstado = {
    palavraSecreta,
    modo,
    dica: customDica ? customDica.trim() : null,
    criadorPalavraId: modo === "desafio" ? jogador1Id : null,
    jogador1Palpites: [],
    jogador2Palpites: [],
  };

  // No modo desafio, quem joga primeiro é quem tem que adivinhar (jogador2)
  const quemComecaId = modo === "desafio" ? jogador2Id : jogador1Id;

  return {
    tipo: "termo_versus",
    partidaId: `termo_${agora}_${Math.random().toString(36).substring(2, 6)}`,
    jogador1Id,
    jogador1Nome,
    jogador1Username: jogador1Username ? jogador1Username.replace(/^@/, "") : null,
    jogador2Id,
    jogador2Nome,
    jogador2Username: jogador2Username ? jogador2Username.replace(/^@/, "") : null,
    turnoAtualId: quemComecaId,
    quemIniciouId: quemComecaId,
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

/**
 * Processa um palpite de 5 letras submetido por um jogador
 */
export function processarPalpiteTermo(
  payload: JogoChatPayload,
  palpiteBruto: string,
  jogadorId: string,
  jogadorUsername?: string
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi finalizada." };
  }

  const palpite = normalizarPalavra(palpiteBruto);
  if (palpite.length !== TAMANHO_PALAVRA) {
    return { sucesso: false, erro: `A palavra precisa ter exatamente ${TAMANHO_PALAVRA} letras.` };
  }

  if (!isPalavraValidaDicionario(palpite)) {
    return { sucesso: false, erro: `"${palpite}" não consta no dicionário de português.` };
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
    return { sucesso: false, erro: "Aguarde o palpite do seu adversário!" };
  }

  const estado = payload.estado as JogoTermoEstado;
  const meusPalpites = isJogador1 ? [...estado.jogador1Palpites] : [...estado.jogador2Palpites];

  if (meusPalpites.length >= MAX_TENTATIVAS) {
    return { sucesso: false, erro: "Você já usou todas as 6 tentativas nesta rodada!" };
  }

  // Avalia o palpite
  const feedback = avaliarPalpite(palpite, estado.palavraSecreta);
  const acertou = feedback.every(s => s === "correto");

  meusPalpites.push({
    palavra: palpite,
    feedback,
  });

  const placar = {
    jogador1: payload.placar?.jogador1 ?? 0,
    jogador2: payload.placar?.jogador2 ?? 0,
    empates: payload.placar?.empates ?? 0,
  };

  let status: "em_andamento" | "vitoria" | "empate" = "em_andamento";
  let vencedorId: string | null = null;
  let vencedorNome: string | null = null;
  let proximoTurnoId = isJogador1 ? payload.jogador2Id : payload.jogador1Id;

  // Lógica no modo Desafio (onde um desafiou o outro com palavra própria)
  if (estado.modo === "desafio") {
    if (acertou) {
      status = "vitoria";
      vencedorId = isJogador1 ? payload.jogador1Id : payload.jogador2Id;
      vencedorNome = isJogador1 ? payload.jogador1Nome : payload.jogador2Nome;
      if (isJogador1) placar.jogador1 += 1;
      else placar.jogador2 += 1;
    } else if (meusPalpites.length >= MAX_TENTATIVAS) {
      // Esgotou as tentativas no desafio: quem criou a palavra venceu!
      status = "vitoria";
      const criadorId = estado.criadorPalavraId || payload.jogador1Id;
      const isCriadorJ1 = criadorId === payload.jogador1Id;
      vencedorId = isCriadorJ1 ? payload.jogador1Id : payload.jogador2Id;
      vencedorNome = isCriadorJ1 ? payload.jogador1Nome : payload.jogador2Nome;
      if (isCriadorJ1) placar.jogador1 += 1;
      else placar.jogador2 += 1;
    }
  } else {
    // Modo Aleatório (Duelo em Turnos pela mesma palavra)
    if (acertou) {
      status = "vitoria";
      vencedorId = isJogador1 ? payload.jogador1Id : payload.jogador2Id;
      vencedorNome = isJogador1 ? payload.jogador1Nome : payload.jogador2Nome;
      if (isJogador1) placar.jogador1 += 1;
      else placar.jogador2 += 1;
    } else {
      const outrosPalpites = isJogador1 ? estado.jogador2Palpites : estado.jogador1Palpites;
      // Se ambos atingiram 6 tentativas sem acertar
      if (meusPalpites.length >= MAX_TENTATIVAS && outrosPalpites.length >= MAX_TENTATIVAS) {
        status = "empate";
        placar.empates += 1;
      }
    }
  }

  const novoEstado: JogoTermoEstado = {
    ...estado,
    jogador1Palpites: isJogador1 ? meusPalpites : estado.jogador1Palpites,
    jogador2Palpites: isJogador2 ? meusPalpites : estado.jogador2Palpites,
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

/**
 * Reinicia a partida de Termo (Revanche 1 a 1 com revezamento justo de quem começa)
 */
export function reiniciarPartidaTermo(
  payloadAntigo: JogoChatPayload,
  customPalavra?: string,
  customDica?: string
): JogoChatPayload {
  const agora = Date.now();
  const j1Id = payloadAntigo.jogador1Id;
  const j2Id = payloadAntigo.jogador2Id;
  const ultimoIniciador = payloadAntigo.quemIniciouId || j1Id;
  const novoQueComecaId = ultimoIniciador === j1Id ? j2Id : j1Id;

  const modo = customPalavra && customPalavra.trim().length === TAMANHO_PALAVRA ? "desafio" : "aleatorio";
  const palavraSecreta = modo === "desafio" ? normalizarPalavra(customPalavra!) : sortearPalavraTermo();

  const estado: JogoTermoEstado = {
    palavraSecreta,
    modo,
    dica: customDica ? customDica.trim() : null,
    criadorPalavraId: modo === "desafio" ? novoQueComecaId : null,
    jogador1Palpites: [],
    jogador2Palpites: [],
  };

  return {
    ...payloadAntigo,
    partidaId: `termo_${agora}_${Math.random().toString(36).substring(2, 6)}`,
    quemIniciouId: novoQueComecaId,
    turnoAtualId: novoQueComecaId,
    estado,
    status: "em_andamento",
    vencedorId: null,
    vencedorNome: null,
    atualizadoEm: agora,
  };
}
