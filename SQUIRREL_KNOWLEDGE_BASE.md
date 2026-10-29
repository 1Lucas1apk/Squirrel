# 🐿️ SQUIRREL (Ecliptia CX) — Knowledge Base & Especificação Completa

> **Versão da Base:** 2026.final  
> **Identidade do Desenvolvedor:** `1lucas1apk` (Lucas Morais / Ecliptia)  
> **Package Name Android:** `com.ecliptia.cx`  
> **Repositório / Branch Principal:** `rework-ui` / `master`  
> **Objetivo deste documento:** Servir como fonte única da verdade para restaurar 100% do contexto do projeto do zero para qualquer desenvolvedor ou agente IA.

---

## 1. O Que É o Squirrel (Visão de Produto)

O **Squirrel** é um aplicativo móvel e web de **gestão, controle e conferência de caixa de ponto de venda (PDV)** voltado para operadores de crediário, lojas físicas, balcão e caixas comerciais.

### O Problema Real que o App Resolve:
No dia a dia de uma loja com crediário/balcão, o operador recebe pagamentos em **dinheiro vivo** (cédulas/moedas) e também via **Pix no celular** (do operador ou do gerente). Além disso:
1. O operador realiza **trocas informais de dinheiro por Pix** (cliente quer dinheiro vivo da gaveta e manda Pix para o operador, ou vice-versa).
2. O operador precisa saber no fim do turno **exatamente quanto colocar em espécie no saco de malote** (envelope físico) e **quanto transferir via Pix de repasse** para a conta bancária da empresa para fechar 100% a meta exigida pelo sistema da loja.
3. Precisa conferir 1 a 1 os **canhotos físicos de cartão/carnê (Checklist)** para garantir que nenhuma transação foi digitada errada.
4. Precisa auditar **empréstimos temporários a terceiros**, **convênios com empresas parceiras** e identificar se houve **sobra** ou **quebra** de caixa.

---

## 2. A Matemática Fundamental do Caixa

O motor de cálculo está localizado em [`src/features/fechamento/calculos.ts`](file:///C:/Users/1luca/Desktop/Squirrel/src/features/fechamento/calculos.ts) e é consumido pelo hook [`useCaixaSeguro`](file:///C:/Users/1luca/Desktop/Squirrel/src/hooks/use-caixa-seguro.ts).

### 2.1. Fórmulas Principais:

```
─────────────────────────────────────────────────────────────────────────────
1. TOTAL DO SISTEMA (S)
   S = Σ(Vendas/Entradas) - Σ(Sangrias) - Σ(Cancelamentos)

2. ENTRADA FÍSICA REAL (E_real)
   E_real = Σ(Valor Recebido Físico das Vendas) - Σ(Sangrias/Cancelamentos)

3. SALDO DE PAPEL POR TROCAS DE PIX (SaldoPapel)
   SaldoPapel = - Σ(Pix Recebido Gaveta Saiu) + Σ(Destroca Pix por Nota)

4. GAVETA FÍSICA ATUAL (G)
   G = E_real + AjusteManualSobra + SaldoPapel + EmpréstimosFísicos

5. DISPONÍVEL PARA O MALOTE (D)
   D = max(0, G - EmpréstimosFísicos)

6. COMPOSIÇÃO DO MALOTE (Invariante: Espécie + PixRepasse = S)
   • Se D >= S:
       Espécie no Envelope = S
       Pix de Repasse = 0
   • Se D < S:
       Espécie no Envelope = D
       Pix de Repasse = S - D

7. SOBRA / QUEBRA REAL (Δ)
   Δ = (G - EmpréstimosFísicos) + PixNoCaixa + PixDiretoLoja - S
   • Δ == 0   → Caixa Perfeito (Equilibrado)
   • Δ > 0    → Sobra de Caixa
   • Δ < 0    → Quebra de Caixa (Falta de dinheiro)
─────────────────────────────────────────────────────────────────────────────
```

### 2.2. Exemplo Prático da Matemática:
* Sistema registrou: **R$ 1.000,00**
* Cliente pediu R$ 200,00 da gaveta e transferiu R$ 200,00 via Pix para o operador (*Fantasma: Pix Recebido / Gaveta Saiu*).
* Dinheiro em cédulas na gaveta agora: **R$ 800,00** (D = 800).
* **Fechamento Automático do Squirrel:**
  * **No Saco Físico (Envelope):** R$ 800,00 em cédulas.
  * **Pix de Repasse:** R$ 200,00 transferidos da conta do operador para a conta da loja.
  * **Total Malote Entregue:** R$ 800 + R$ 200 = **R$ 1.000,00** (100% do Sistema batido!).

---

## 3. Conceitos e Entidades do Domínio

| Entidade / Conceito | Descrição |
| :--- | :--- |
| **Transação** | Venda ou baixa de carnê realizada no PDV. Categorias: `dinheiro`, `entrada_prestacao`, `compra_vista`, `gar`, `multiplo`, `sangria`, `cancelamento`. |
| **Fantasma (Lembrete)** | Movimentação financeira informal ou pendência que altera a gaveta física mas não está no sistema oficial da loja. |
| **`pix_recebido_gaveta_saiu`** | Entrou Pix no celular (do operador ou gerente) e o operador tirou o valor em notas da gaveta. |
| **`destroca_pix_por_nota`** | O operador devolveu dinheiro em notas para a gaveta para resgatar/limpar o saldo de Pix anterior. |
| **`dinheiro_emprestado`** | Valor de terceiros guardado temporariamente na gaveta (não pertence ao malote da loja). |
| **Registro POS** | Venda em maquininha de cartão (`cartao`, `pix_loja`, `gas_do_povo`). |
| **Registro Convênio** | Venda faturada para empresas parceiras/sindicatos sem entrada de dinheiro na hora. |
| **Checklist (Canhotos)** | Conferência manual de canhotos de papel para confirmar se o valor do comprovante bate com o sistema. |
| **Modo Discreto** | Modo de camuflagem de tela que esconde quebras/sobras e simula que 100% do caixa está em dinheiro físico. |

---

## 4. Estrutura de Telas e Navegação

1. **[`src/screens/main-screen.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/screens/main-screen.tsx):**
   * Header flutuante de vidro (Status do turno, data de referência, botão de sincronização, botão discreto, botão de recados).
   * Navegação inferior em cápsula flutuante (*Painel, Transações, Checklist, Convênio, Fantasmas, Histórico*).
2. **[`src/screens/painel-screen.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/screens/painel-screen.tsx) & [`painel-principal.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/components/dashboard/painel-principal.tsx):**
   * Card Hero: **Total do Caixa** (com gabarito de cédulas por toque triplo).
   * Barra de proporção (Papel vs Pix).
   * Composição do Malote lado a lado (**Dinheiro no Saco** vs **Pix Repasse**).
   * Dock unificado de indicadores (Saídas e Canhotos OK).
   * Card do Bate-papo da equipe em tempo real.
   * Carrossel de Atividades Recentes + Acesso à Auditoria completa.
3. **[`src/screens/transacoes-screen.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/screens/transacoes-screen.tsx):**
   * Lançamento rápido de vendas e sangrias.
   * Suporte a múltiplos contratos/carnês por cliente.
   * Bandeja inteligente de conferência de troco e sobra.
   * **Modo Misto:** Seleção 100% manual sem ativação forçada de Pix.
4. **[`src/screens/checklist-screen.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/screens/checklist-screen.tsx):**
   * Progresso visual de conferência de canhotos.
   * Relatório de erros e divergências com justificativa.
5. **[`src/screens/convenio-screen.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/screens/convenio-screen.tsx):**
   * Controle de faturamento de convênios.
6. **[`src/screens/fantasmas-screen.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/screens/fantasmas-screen.tsx):**
   * Rastreio de trocas de Pix e empréstimos.
7. **[`src/screens/historico-screen.tsx`](file:///C:/Users/1luca/Desktop/Squirrel/src/screens/historico-screen.tsx):**
   * Lista de turnos passados com gráfico de fluxo Wagmi de 7 dias.
   * Toggle direto de "Repassado".
   * Abertura direta do turno ao tocar no card (sem emojis ou botões adicionais).
   * Lixeira segura com restauração e exclusão permanente.

---

## 5. Guia Definitivo de Compilação Local do APK (Android)

> [!IMPORTANT]
> O projeto utiliza **build 100% local via Gradle**. Não utilizamos servidores Expo nem EAS.

### 5.1. Pré-requisitos e Variáveis de Ambiente no Windows:
* **JDK 17:** Eclipse Adoptium Temurin 17 instalado em:
  `C:\Users\1luca\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2`
* **Android SDK:** Localizado em:
  `C:\Users\1luca\AppData\Local\Android\Sdk`
* **Keystore Oficial de Release:** Localizado em:
  [`android/app/release.keystore`](file:///C:/Users/1luca/Desktop/Squirrel/android/app/release.keystore)
  * **Alias:** `1lucas1apk`
  * **StorePass / KeyPass:** `squirrelpass`
  * **DN:** `CN=1lucas1apk, OU=1lucas1apk, O=Ecliptia, L=Manaus, ST=Amazonas, C=BR`

### 5.2. Comando Exato para Compilar o APK Release:

Execute no PowerShell:

```powershell
$env:JAVA_HOME = "C:\Users\1luca\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:ANDROID_HOME = "C:\Users\1luca\AppData\Local\Android\Sdk"
cd C:\Users\1luca\Desktop\Squirrel\android
.\gradlew.bat assembleRelease --no-daemon
```

### 5.3. Saída do APK:
* O arquivo gerado estará em:
  [`android/app/build/outputs/apk/release/app-release.apk`](file:///C:/Users/1luca/Desktop/Squirrel/android/app/build/outputs/apk/release/app-release.apk)
* Para verificar a assinatura:
  ```powershell
  & "C:\Users\1luca\AppData\Local\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs "android\app\build\outputs\apk\release\app-release.apk"
  ```

---

## 6. Regras Críticas de UI e Compatibilidade Android Yoga

1. **Tipografia e Moeda:**
   * **NUNCA** use `<View className="flex-row items-baseline">` com múltiplos `<Text>` para renderizar moedas com centavos destacados. No Android Yoga Engine, isso causa sobreposição de texto ("letras prensadas").
   * **SEMPRE** use um único `<Text>` pai com `<Text>` aninhados (Spannable String nativo).
2. **Inputs em Linhas (`flex-row`):**
   * **SEMPRE** use `flex-1` nos campos de texto/moeda dentro de `flex-row`. Nunca use `w-full`, pois estoura a largura da tela no Android.
3. **Respiro do ScrollView:**
   * O container principal com scroll deve ter `paddingBottom: 130` para garantir que o menu inferior flutuante nunca sobreponha o rodapé.
4. **Nomes Pessoais e Placeholders:**
   * **NUNCA** use nomes pessoais (ex: "Lucas") no meio dos campos ou placeholders. Use apenas rótulos genéricos e profissionais (*"Nome do Cliente"*, *"Operador"*, etc.).
5. **Permissões do Android:**
   * **NUNCA** adicione `SYSTEM_ALERT_WINDOW` ou permissões legadas de armazenamento ao `AndroidManifest.xml` de release para evitar alertas do Google Play Protect.
6. **Espaçamento Nativo no NativeWind (`gap-*` vs `space-y-*`):**
   * **NUNCA** use utilitários `space-y-*` ou `space-x-*`. O NativeWind v4 gera seletores CSS `> * + *` que não existem no React Native nativo (Android/iOS), sendo ignorados em tempo de execução e causando o layout "tudo colado/juntinho" com zero margem.
   * **SEMPRE** use `gap-*` (`gap-1`, `gap-1.5`, `gap-2`, `gap-2.5`, `gap-3`, `gap-4`), que é suportado nativamente pelo Yoga Flexbox e funciona 100% igual no Web e no APK Android.

