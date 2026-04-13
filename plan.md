# Plano de Execução — Projeto **Squirrel** (App "Caixa Seguro") v5.0

## 1) Objetivo do Produto
Construir um app mobile (React Native + Expo) para fechamento diário de caixa em dinheiro, com foco em velocidade operacional, tema escuro, atualização instantânea e separação clara entre:

- **Total do Sistema** (o que a loja exige oficialmente)
- **Operação Real de Gaveta** (espécie física + apoio em Pix pessoal)

Regra central: **Movimentos Fantasmas não alteram o Total do Sistema**.

---

## 2) Contexto Operacional (Resumo de Negócio)
- Usuário: operador de caixa da Clara Eletro.
- Rotina: fechamento de dias leves (3 recibos) até dias de pico (30+ recibos, até ~R$ 16.000,00).
- Necessidade crítica: o sistema oficial enxerga 100% “dinheiro”, mas a operação real pode ser mista (**cédulas + Pix apoio**).
- App deve ajudar na montagem do envelope final sem “contaminar” o cálculo oficial.

---

## 3) Stack e Princípios Técnicos
- **Framework Base:** React Native gerenciado pelo **Expo**.
- **Banco:** **Firebase Realtime Database** (reatividade em tempo real).
- **UI/Tema Escuro:** **NativeWind** (Tailwind no React Native).
- **Arquitetura:** modular, por domínio, sem arquivos monolíticos.
- **Código:** limpo, desacoplado, orientado a componentes e serviços.

---

## 4) Regras de Negócio (Fonte da Verdade)

### 4.1 Categorias que impactam o Total do Sistema
1. **Entradas/Vendas**: somam no total.
2. **Sangrias**: subtraem no total.
3. **Cancelamentos**: subtraem no total e exigem alerta/justificativa física.

### 4.2 Categorias que NÃO impactam o Total do Sistema
1. **Movimento Fantasma**: lembrete/checklist operacional.
2. **Troca com Gerente / Faltas**: usado para acompanhamento real e cálculo do repasse Pix, sem alterar total oficial.
3. **Anotações Ex-Caixa (Ricardo)**: memória operacional do dia, sem efeito matemático no total oficial.

### 4.3 Fórmulas-chave
- **Total do Sistema = Entradas - Sangrias - Cancelamentos**
- **Sobra (Caixinha)**: acumulada por trocos não devolvidos + ajustes manuais.
- **Pacote de Fechamento (Envelope)**:
  - **Espécie (Cédulas)**
  - **Pix Repasse (Conta de Apoio)**
  - Exibir separadamente para escrita no malote.

---

## 5) Escopo Funcional do MVP
- Dashboard com números grandes.
- Cadastro rápido de transações.
- Cálculo automático de troco/sobra.
- Ajuste manual de sobra (uso de centavos para cobrir pagamentos).
- Modo “Novo Dia” e “Continuar Dia Anterior”.
- Módulo de checklist sob demanda (pendente/amarelo, confirmado/azul).
- Módulo de lembretes fantasmas (roxo + checkbox resolvido).
- Bloco de “Assistente de Envelope” com espécie vs pix repasse.

---

## 6) Estrutura de Dados (Firebase Realtime Database)

```txt
turnos/
  {id_turno}/
    data_referencia: "YYYY-MM-DD"
    status_turno: "aberto" | "fechado"
    totais/
      sistema: number
      sobra: number
      especie_envelope: number
      pix_repasse: number
    metadados/
      criado_em: timestamp
      atualizado_em: timestamp

transacoes/
  {id_turno}/
    {id_transacao}/
      timestamp: number
      categoria: "entrada" | "sangria" | "cancelamento" | "multiplo"
      descricao: string
      valor_sistema: number
      valor_recebido_fisico: number
      troco_sobra: number
      status_conferencia: "pendente" | "confirmada"
      alerta_justificativa: boolean
      justificativa_texto: string | null

fantasmas_lembretes/
  {id_turno}/
    {id_lembrete}/
      tipo: "gerente_troca" | "ricardo" | "outro"
      descricao: string
      valor_referencia: number
      impacta_pix_repasse: boolean
      resolvido: boolean
      comprovado_pix: boolean
      criado_em: timestamp
      atualizado_em: timestamp
```

---

## 7) Arquitetura de Pastas (proposta)
```txt
Squirrel/
  app/
    (tabs)/
      dashboard.tsx
      transacoes.tsx
      checklist.tsx
      fantasmas.tsx
      configuracoes.tsx
    _layout.tsx
    index.tsx
  src/
    components/
      dashboard/
      transacoes/
      checklist/
      fantasmas/
      common/
    features/
      fechamento/
      sobra/
      conferencias/
      fantasmas/
      turnos/
    services/
      firebase/
        config.ts
        db.ts
      repositories/
    hooks/
    store/
    utils/
      currency.ts
      date.ts
      validations.ts
    types/
  assets/
  app.config.ts
  tailwind.config.js
  nativewind-env.d.ts
  babel.config.js
```

---

## 8) Fluxos de Tela
1. **Abertura**: escolher Novo Dia ou Continuar Dia Anterior.
2. **Dashboard**: visualizar Total do Sistema, Sobra, Envelope, pendências fantasmas.
3. **Adicionar Transação**:
   - informar valores (parcela/recebido físico),
   - registrar categoria,
   - atualizar totais em tempo real.
4. **Checklist de Recibos**: conferir itens do papel, marcar confirmadas (azul).
5. **Fantasmas**: criar lembretes, marcar resolvido, conferir Pix recebido.
6. **Fechamento**: usar assistente de envelope para registrar espécie vs pix repasse.

---

## 9) UX/UI (Dark Mode obrigatório)
- Fundo escuro, contraste alto, números grandes e legíveis.
- Cores funcionais:
  - **Amarelo**: pendente conferência
  - **Azul**: conferido
  - **Roxo**: fantasmas/lembretes
  - **Vermelho**: alertas de cancelamento/justificativa
  - **Verde**: confirmações financeiras
- Campos de input com foco em digitação rápida (teclado numérico).
- Botões e ações principais sempre acessíveis com uma mão.

---

## 10) Checklist Completo de Implementação

## A. Setup Base
- [ ] Inicializar projeto Expo (TypeScript).
- [ ] Configurar NativeWind + Tailwind.
- [ ] Configurar Firebase SDK + Realtime Database.
- [ ] Definir variáveis de ambiente (chaves Firebase).
- [ ] Configurar aliases de import e estrutura de pastas.

## B. Modelagem e Tipagem
- [ ] Criar tipos TS para turno, transação, lembrete fantasma, totais.
- [ ] Definir enums/constantes de categorias e status.
- [ ] Criar validadores de input monetário e textos obrigatórios.

## C. Regras de Cálculo
- [ ] Implementar cálculo do Total do Sistema.
- [ ] Implementar cálculo de Sobra com troco não devolvido.
- [ ] Implementar ajuste manual de sobra.
- [ ] Implementar cálculo de Espécie vs Pix Repasse.
- [ ] Garantir que fantasmas **não** afetem Total do Sistema.

## D. Firebase (Realtime)
- [ ] Criar camada de serviço para leitura/escrita em tempo real.
- [ ] Criar listeners por turno ativo.
- [ ] Persistir transações com status de conferência.
- [ ] Persistir lembretes fantasmas com `resolvido` e `comprovado_pix`.
- [ ] Atualizar dashboard instantaneamente em qualquer alteração.

## E. Telas e Componentes
- [ ] Tela de seleção de turno (novo/continuar).
- [ ] Dashboard principal com cards de saldo.
- [ ] Formulário de adição rápida.
- [ ] Lista de transações com status visual.
- [ ] Modo checklist de recibos.
- [ ] Módulo de fantasmas em roxo.
- [ ] Assistente de envelope (espécie/pix).

## F. Experiência Operacional
- [ ] Otimizar ações com poucos toques.
- [ ] Teclado numérico para campos de valor.
- [ ] Estados vazios claros e objetivos.
- [ ] Mensagens de erro/alerta diretas.
- [ ] Sinalização explícita para cancelamento com justificativa.

## G. Qualidade e Segurança de Regra
- [ ] Testar cenários de pico (30+ transações).
- [ ] Testar cenários com cancelamento e fechamento negativo.
- [ ] Testar cenários com múltiplo (somente parte em espécie).
- [ ] Testar fluxo de gerente/ricardo sem impacto no total oficial.
- [ ] Validar consistência de atualização em tempo real.

## H. Organização de Código
- [ ] Garantir componentes pequenos e reutilizáveis.
- [ ] Separar lógica de cálculo em `features/` e `utils/`.
- [ ] Evitar acoplamento entre UI e Firebase.
- [ ] Padronizar nomenclatura e contratos de dados.

## I. Entrega
- [ ] Revisar aderência integral à especificação v5.0.
- [ ] Revisar performance de renderização em listas.
- [ ] Revisar UX de fechamento (envelope).
- [ ] Preparar build de desenvolvimento com Expo.

---

## 11) Critérios de Aceite
- App 100% dark mode.
- Dashboard atualiza em tempo real via Firebase.
- Total do Sistema sempre respeita fórmula oficial.
- Fantasmas nunca alteram cálculo oficial.
- Assistente de Envelope mostra separação espécie/pix de forma clara.
- Checklist de recibos funciona com status visual pendente/confirmado.
- Estrutura de código modular e fácil de manutenção por arquivo/pasta.

---

## 12) Riscos e Mitigações
- **Risco:** confundir fantasia com transação oficial.  
  **Mitigação:** separar nós, tipos, telas e cores.

- **Risco:** cálculos inconsistentes por arredondamento.  
  **Mitigação:** utilitários monetários únicos e padronizados.

- **Risco:** lentidão em dia de pico.  
  **Mitigação:** listeners por turno, paginação/lista otimizada.

---

## 13) Próxima Fase (Execução)
Iniciar implementação por etapas curtas:
1. Setup técnico.
2. Modelagem e regras de cálculo.
3. Dashboard + transações.
4. Fantasmas + checklist.
5. Fechamento e polimento.

