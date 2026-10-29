import { JogoChatPayload, JogoForcaEstado } from "../../types/domain";

export const MAX_ERROS_FORCA = 6;

/**
 * Normaliza qualquer palavra ou letra removendo acentos e deixando em maiúsculas
 */
export function normalizarTextoForca(t: string): string {
  if (!t) return "";
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .trim();
}

/**
 * Banco de palavras temáticas com dicas para o modo sorteio instantâneo
 */
export const PALAVRAS_SORTEIO_FORCA: Array<{ palavra: string; tema: string; dica: string }> = [
  { palavra: "CHOCOLATE", tema: "Sobremesa / Doce", dica: "Feito a partir do cacau e muito adorado no mundo todo." },
  { palavra: "COMPUTADOR", tema: "Tecnologia / Escritório", dica: "Dispositivo eletrônico indispensável para o trabalho moderno." },
  { palavra: "ASTRONAUTA", tema: "Profissão / Espaço", dica: "Viaja para fora da atmosfera terrestre em missões espaciais." },
  { palavra: "GIRAFA", tema: "Animal / Natureza", dica: "Mamífero terrestre mais alto do planeta com pescoço longo." },
  { palavra: "GUITARRA", tema: "Instrumento Musical", dica: "Possui cordas e é muito usada em bandas de Rock." },
  { palavra: "PIZZA", tema: "Comida / Gastronomia", dica: "Massa redonda assada no forno muito popular aos sábados." },
  { palavra: "DINOSSAURO", tema: "História / Pré-história", dica: "Criaturas gigantescas que habitaram a Terra há milhões de anos." },
  { palavra: "TORNADO", tema: "Fenômeno Natural", dica: "Coluna de ar em rotação violenta ligada a nuvens de tempestade." },
  { palavra: "CAIPIRINHA", tema: "Bebida Típica", dica: "Feita com cachaça, limão, açúcar e gelo no Brasil." },
  { palavra: "ESMERALDA", tema: "Pedra Preciosa", dica: "Gema verde brilhante muito valiosa na joalheria." },
  { palavra: "ARQUITETO", tema: "Profissão", dica: "Projeta prédios, casas e espaços urbanos inovadores." },
  { palavra: "CROCODILE", tema: "Animal Selvagem", dica: "Grande réptil semiaquático de mordida extremamente potente." },
  { palavra: "HEPATITE", tema: "Saúde / Biologia", dica: "Inflamação no fígado que pode ter origem viral ou medicamentosa." },
  { palavra: "PIRAMIDE", tema: "Monumento / História", dica: "Construções monumentais feitas pelos antigos faraós no Egito." },
  { palavra: "FUTEBOL", tema: "Esporte", dica: "Paixão nacional brasileira jogada com 11 em campo." },
  { palavra: "TELEFONE", tema: "Comunicação", dica: "Invenção que revolucionou o contato por voz à distância." },
  { palavra: "MERCADO", tema: "Comércio", dica: "Lugar onde pessoas compram mantimentos e alimentos diários." },
  { palavra: "GIRASSOL", tema: "Botânica / Flor", dica: "Flor amarela radiante que acompanha a trajetória do sol." },
  { palavra: "SUBMARINO", tema: "Náutica / Marinha", dica: "Embarcação capaz de navegar e operar sob as profundezas do oceano." },
  { palavra: "HAMBURGUER", tema: "Alimentação Rápida", dica: "Pão com carne moída grelhada e queijo derretido." }
];

export function sortearPalavraForca(): { palavra: string; tema: string; dica: string } {
  const idx = Math.floor(Math.random() * PALAVRAS_SORTEIO_FORCA.length);
  return PALAVRAS_SORTEIO_FORCA[idx];
}

/**
 * Cria um novo payload de jogo da forca:
 * - Se palavraCustom for passada: Modo Desafio (Criador vs Adivinhador).
 * - Se palavraCustom NÃO for passada: Modo Duelo 1v1 (ambos adivinham em turnos alternados).
 */
export function criarPartidaForca(
  jogador1Id: string,
  jogador1Nome: string,
  jogador1Username: string | null | undefined,
  jogador2Id: string,
  jogador2Nome: string,
  jogador2Username: string | null | undefined,
  palavraCustom?: string,
  temaCustom?: string,
  dicaInicial?: string
): JogoChatPayload {
  const isDesafio = Boolean(palavraCustom && palavraCustom.trim().length >= 3);
  let palavra = "";
  let tema = "";
  let dica = "";

  if (isDesafio) {
    palavra = normalizarTextoForca(palavraCustom!);
    tema = (temaCustom || "Palavra Secreta").trim();
    dica = (dicaInicial || "").trim();
  } else {
    const sorteada = sortearPalavraForca();
    palavra = sorteada.palavra;
    tema = sorteada.tema;
    dica = sorteada.dica;
  }

  const estadoForca: JogoForcaEstado = {
    modo: isDesafio ? "desafio_criador" : "duelo_aleatorio",
    palavraSecreta: palavra,
    tema,
    dicas: dica ? [dica] : [],
    letrasChutadas: [],
    errosMaximos: MAX_ERROS_FORCA,
    errosAtuais: 0,
    criadorId: isDesafio ? jogador1Id : null,
    adivinhadorId: isDesafio ? jogador2Id : null,
    ultimoChutePorId: null,
    pediuDica: false,
    letrasReveladasPeloCriador: []
  };

  const partidaId = `forca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    tipo: "forca",
    partidaId,
    jogador1Id,
    jogador1Nome,
    jogador1Username,
    jogador2Id,
    jogador2Nome,
    jogador2Username,
    turnoAtualId: isDesafio ? jogador2Id : jogador1Id,
    quemIniciouId: jogador1Id,
    estado: estadoForca,
    status: "em_andamento",
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
 * Processa um chute de letra (A-Z)
 */
export function processarChuteLetraForca(
  payload: JogoChatPayload,
  letraBruta: string,
  jogadorId: string,
  jogadorUsername?: string | null
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string; acertou?: boolean } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi encerrada." };
  }

  const estado = payload.estado as JogoForcaEstado;
  const letra = normalizarTextoForca(letraBruta);

  if (!letra || letra.length !== 1) {
    return { sucesso: false, erro: "Por favor, chute apenas uma letra." };
  }

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

  // Se for Modo Desafio: apenas o adivinhador (jogador2) chuta!
  if (estado.modo === "desafio_criador") {
    if (!isJogador2) {
      return { sucesso: false, erro: "Você é o criador da palavra! Apenas o adivinhador pode chutar letras." };
    }
  } else {
    // Modo Duelo 1v1: validação estrita de turno
    const turnoId = (payload.turnoAtualId || "").toLowerCase().trim();
    const isMeuTurno = (isJogador1 && (turnoId === j1Id || turnoId === j1User)) ||
                       (isJogador2 && (turnoId === j2Id || turnoId === j2User));

    if (!isMeuTurno) {
      return { sucesso: false, erro: "Aguarde o turno do seu adversário para chutar." };
    }
  }

  // Letra já chutada?
  if (estado.letrasChutadas.includes(letra)) {
    return { sucesso: false, erro: `A letra '${letra}' já foi chutada nesta partida.` };
  }

  const novasLetras = [...estado.letrasChutadas, letra];
  const palavraNorm = normalizarTextoForca(estado.palavraSecreta);
  const acertou = palavraNorm.includes(letra);

  let novosErros = estado.errosAtuais;
  if (!acertou) {
    novosErros += 1;
  }

  const todasReveladas = palavraNorm.split("").every(char => novasLetras.includes(char));

  let novoStatus: "em_andamento" | "vitoria" | "empate" = "em_andamento";
  let vencedorId: string | null = null;
  let vencedorNome: string | null = null;

  // Próximo turno (no modo duelo 1v1, alterna para o outro jogador)
  let proximoTurnoId = payload.turnoAtualId;
  if (estado.modo === "duelo_aleatorio") {
    proximoTurnoId = isJogador1 ? payload.jogador2Id : payload.jogador1Id;
  }

  if (todasReveladas) {
    novoStatus = "vitoria";
    if (estado.modo === "desafio_criador") {
      vencedorId = payload.jogador2Id;
      vencedorNome = payload.jogador2Nome;
    } else {
      // No duelo 1v1, quem acertou a última letra ganha!
      vencedorId = isJogador1 ? payload.jogador1Id : payload.jogador2Id;
      vencedorNome = isJogador1 ? payload.jogador1Nome : payload.jogador2Nome;
    }
  } else if (novosErros >= estado.errosMaximos) {
    if (estado.modo === "desafio_criador") {
      novoStatus = "vitoria";
      vencedorId = payload.jogador1Id; // Criador defendeu o enigma!
      vencedorNome = payload.jogador1Nome;
    } else {
      // No duelo 1v1, ambos foram enforcados (derrota coletiva / empate)
      novoStatus = "empate";
      vencedorId = null;
      vencedorNome = null;
    }
  }

  const placarAtual = payload.placar || { jogador1: 0, jogador2: 0, empates: 0 };
  const novoPlacar = {
    jogador1: vencedorId === payload.jogador1Id ? placarAtual.jogador1 + 1 : placarAtual.jogador1,
    jogador2: vencedorId === payload.jogador2Id ? placarAtual.jogador2 + 1 : placarAtual.jogador2,
    empates: novoStatus === "empate" ? placarAtual.empates + 1 : placarAtual.empates
  };

  const novoEstado: JogoForcaEstado = {
    ...estado,
    letrasChutadas: novasLetras,
    errosAtuais: novosErros,
    ultimoChutePorId: isJogador1 ? payload.jogador1Id : payload.jogador2Id
  };

  const novoPayload: JogoChatPayload = {
    ...payload,
    turnoAtualId: proximoTurnoId,
    estado: novoEstado,
    status: novoStatus,
    vencedorId,
    vencedorNome,
    placar: novoPlacar,
    atualizadoEm: Date.now()
  };

  return { sucesso: true, novoPayload, acertou };
}

/**
 * Chute arriscado da palavra inteira de uma vez
 */
export function processarChutePalavraInteiraForca(
  payload: JogoChatPayload,
  palpiteBruto: string,
  jogadorId: string,
  jogadorUsername?: string | null
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string; acertou?: boolean } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi encerrada." };
  }

  const estado = payload.estado as JogoForcaEstado;
  const palpite = normalizarTextoForca(palpiteBruto);
  const palavraNorm = normalizarTextoForca(estado.palavraSecreta);

  if (!palpite || palpite.length < 2) {
    return { sucesso: false, erro: "Digite a palavra completa para chutar." };
  }

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

  if (estado.modo === "desafio_criador" && !isJogador2) {
    return { sucesso: false, erro: "Você é o criador! Apenas o adivinhador pode chutar a palavra." };
  }

  if (estado.modo === "duelo_aleatorio") {
    const turnoId = (payload.turnoAtualId || "").toLowerCase().trim();
    const isMeuTurno = (isJogador1 && (turnoId === j1Id || turnoId === j1User)) ||
                       (isJogador2 && (turnoId === j2Id || turnoId === j2User));

    if (!isMeuTurno) {
      return { sucesso: false, erro: "Aguarde o seu turno para chutar a palavra." };
    }
  }

  const acertou = palpite === palavraNorm;
  let novoStatus: "em_andamento" | "vitoria" | "empate" = "em_andamento";
  let vencedorId: string | null = null;
  let vencedorNome: string | null = null;
  let novosErros = estado.errosAtuais;
  let novasLetras = [...estado.letrasChutadas];

  if (acertou) {
    novoStatus = "vitoria";
    vencedorId = isJogador1 ? payload.jogador1Id : payload.jogador2Id;
    vencedorNome = isJogador1 ? payload.jogador1Nome : payload.jogador2Nome;
    palavraNorm.split("").forEach(l => {
      if (!novasLetras.includes(l)) novasLetras.push(l);
    });
  } else {
    // Penalidade: 2 vidas
    novosErros = Math.min(estado.errosMaximos, estado.errosAtuais + 2);
    if (novosErros >= estado.errosMaximos) {
      if (estado.modo === "desafio_criador") {
        novoStatus = "vitoria";
        vencedorId = payload.jogador1Id;
        vencedorNome = payload.jogador1Nome;
      } else {
        novoStatus = "empate";
      }
    }
  }

  let proximoTurnoId = payload.turnoAtualId;
  if (estado.modo === "duelo_aleatorio") {
    proximoTurnoId = isJogador1 ? payload.jogador2Id : payload.jogador1Id;
  }

  const placarAtual = payload.placar || { jogador1: 0, jogador2: 0, empates: 0 };
  const novoPlacar = {
    jogador1: vencedorId === payload.jogador1Id ? placarAtual.jogador1 + 1 : placarAtual.jogador1,
    jogador2: vencedorId === payload.jogador2Id ? placarAtual.jogador2 + 1 : placarAtual.jogador2,
    empates: novoStatus === "empate" ? placarAtual.empates + 1 : placarAtual.empates
  };

  const novoEstado: JogoForcaEstado = {
    ...estado,
    letrasChutadas: novasLetras,
    errosAtuais: novosErros,
    ultimoChutePorId: isJogador1 ? payload.jogador1Id : payload.jogador2Id
  };

  const novoPayload: JogoChatPayload = {
    ...payload,
    turnoAtualId: proximoTurnoId,
    estado: novoEstado,
    status: novoStatus,
    vencedorId,
    vencedorNome,
    placar: novoPlacar,
    atualizadoEm: Date.now()
  };

  return { sucesso: true, novoPayload, acertou };
}

/**
 * Adiciona uma dica extra enviada pelo criador
 */
export function adicionarDicaCriadorForca(
  payload: JogoChatPayload,
  novaDica: string,
  jogadorId: string,
  jogadorUsername?: string | null
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi encerrada." };
  }

  const estado = payload.estado as JogoForcaEstado;
  const textoDica = (novaDica || "").trim();

  if (!textoDica) {
    return { sucesso: false, erro: "A dica não pode ser vazia." };
  }

  // Validação: no modo desafio apenas o criador pode dar dicas
  if (estado.modo === "desafio_criador") {
    const cleanId = (jogadorId || "").toLowerCase().trim();
    const cleanUser = (jogadorUsername || "").toLowerCase().replace(/^@/, "").trim();
    const cId = (estado.criadorId || "").toLowerCase().trim();
    const j1User = (payload.jogador1Username || "").toLowerCase().replace(/^@/, "").trim();

    const isCriador = (cleanId && cId === cleanId) || (cleanUser && (cId === cleanUser || j1User === cleanUser));
    if (!isCriador) {
      return { sucesso: false, erro: "Apenas o criador da palavra pode adicionar dicas!" };
    }
  }

  const novoEstado: JogoForcaEstado = {
    ...estado,
    dicas: [...estado.dicas, textoDica],
    pediuDica: false
  };

  const novoPayload: JogoChatPayload = {
    ...payload,
    estado: novoEstado,
    atualizadoEm: Date.now()
  };

  return { sucesso: true, novoPayload };
}

/**
 * Aciona o pedido de socorro
 */
export function acionarPedidoDicaForca(
  payload: JogoChatPayload,
  jogadorId: string,
  jogadorUsername?: string | null
): { sucesso: boolean; novoPayload?: JogoChatPayload; erro?: string } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi encerrada." };
  }

  const estado = payload.estado as JogoForcaEstado;
  const novoEstado: JogoForcaEstado = {
    ...estado,
    pediuDica: true
  };

  const novoPayload: JogoChatPayload = {
    ...payload,
    estado: novoEstado,
    atualizadoEm: Date.now()
  };

  return { sucesso: true, novoPayload };
}

/**
 * Revela 1 letra de presente concedida pelo criador
 */
export function revelarLetraCriadorForca(
  payload: JogoChatPayload,
  jogadorId: string,
  jogadorUsername?: string | null
): { sucesso: boolean; novoPayload?: JogoChatPayload; letraRevelada?: string; erro?: string } {
  if (payload.status !== "em_andamento") {
    return { sucesso: false, erro: "Esta partida já foi encerrada." };
  }

  const estado = payload.estado as JogoForcaEstado;
  const palavraNorm = normalizarTextoForca(estado.palavraSecreta);
  const letrasNaoReveladas = palavraNorm.split("").filter(l => !estado.letrasChutadas.includes(l));

  if (letrasNaoReveladas.length === 0) {
    return { sucesso: false, erro: "Todas as letras já foram reveladas." };
  }

  const letra = letrasNaoReveladas[Math.floor(Math.random() * letrasNaoReveladas.length)];
  const novasLetras = [...estado.letrasChutadas, letra];
  const novasLetrasCriador = [...(estado.letrasReveladasPeloCriador || []), letra];

  const todasReveladas = palavraNorm.split("").every(char => novasLetras.includes(char));
  let novoStatus: "em_andamento" | "vitoria" = "em_andamento";
  let vencedorId = payload.vencedorId;
  let vencedorNome = payload.vencedorNome;

  if (todasReveladas) {
    novoStatus = "vitoria";
    vencedorId = payload.jogador2Id;
    vencedorNome = payload.jogador2Nome;
  }

  const novoEstado: JogoForcaEstado = {
    ...estado,
    letrasChutadas: novasLetras,
    letrasReveladasPeloCriador: novasLetrasCriador,
    pediuDica: false
  };

  const novoPayload: JogoChatPayload = {
    ...payload,
    estado: novoEstado,
    status: novoStatus,
    vencedorId,
    vencedorNome,
    atualizadoEm: Date.now()
  };

  return { sucesso: true, novoPayload, letraRevelada: letra };
}
