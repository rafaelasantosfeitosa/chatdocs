# LOOM SCRIPT — ChatDocs Demo

**Duration alvo:** 3:30 — 4:00 (buffer de 1min do limite free do Loom)
**Take único, sem edição.** Idioma: PT-BR. Tom: conversacional, animado, mas direto.
**URL principal aberta antes de gravar:** https://chatdocs-git-main-rafaelasantosfeitosas-projects.vercel.app
**PDF de demo já baixado no desktop** (sugestao: um whitepaper curto, tipo 10-15 paginas, sobre algo nao-tecnico — relatorio anual, manual de produto, contrato modelo).

---

## COLD OPEN — 0:00 a 0:10 (HOOK)

**Cena:** Tela inteira do navegador na landing page do ChatDocs. Webcam no canto.

**Ação:** Aponta pra tela com o cursor enquanto fala. Energia alta.

**Fala (verbatim):**
> "Sabe quando voce tem um PDF de 80 paginas e precisa achar UMA informacao especifica? Em vez de dar Ctrl+F e rezar, voce sobe o arquivo aqui e simplesmente PERGUNTA. Em 3 minutos eu te mostro como funciona — e o codigo todo ta no ar, rodando agora."

---

## CENA 1 — O PROBLEMA + UPLOAD — 0:10 a 0:50

**Cena:** Dashboard do ChatDocs (`/dashboard` ou pagina de upload). Webcam menor.

**Ação:**
1. Clica em "Sign in" se nao estiver logado (Clerk modal abre)
2. Login rapido (Google ou ja logado)
3. Aponta pro botao de upload

**Fala:**
> "Olha, todo mundo que trabalha com documento longo tem esse problema — advogado com contrato, gerente lendo relatorio, founder revisando whitepaper. A ideia do ChatDocs e simples: voce sobe o PDF, a gente quebra em pedacos, indexa, e voce conversa com o documento como se fosse um chat normal."
>
> "Vou subir aqui um PDF de exemplo — e ja aviso, to no plano gratuito da API do Google, entao nada de processar Bibliografia inteira. Mas pra documento normal de trabalho, voa."

**Ação:** Arrasta o PDF pra zona de upload. Mostra a barra de progresso.

---

## CENA 2 — O QUE ACONTECE POR BAIXO (rapido) — 0:50 a 1:20

**Cena:** Continua na tela de upload, processamento rolando. Pode abrir uma aba lateral com o esquema mental ou so falar.

**Fala:**
> "Enquanto sobe, deixa eu te contar o que ta rolando: o PDF e quebrado em pedacos de uns 800 caracteres, cada pedaco vira um vetor numerico — chama embedding — e tudo isso e salvo num Postgres com extensao pgvector la na Neon. Quando voce pergunta algo, a gente busca os pedacos mais parecidos com a pergunta e manda pro Gemini responder."
>
> "Resumindo: o modelo so responde com base no SEU documento. Nao tem alucinacao tirada do nada."

---

## CENA 3 — A PERGUNTA + STREAMING — 1:20 a 2:10

**Cena:** Tela de chat com o documento ja processado.

**Ação:**
1. Digita uma pergunta especifica que tem resposta no PDF (ex: "Qual o prazo de entrega previsto?" ou "Quem e o responsavel pelo capitulo 3?")
2. Aperta Enter
3. Deixa a resposta streamar — DEIXA o usuario ver o texto aparecendo token por token

**Fala (durante o streaming):**
> "Olha so — a resposta vem em streaming, igual ChatGPT. E repara que no final ela cita as fontes."

**Ação:** Aponta pros badges numerados [1] [2] [3] que aparecem.

---

## CENA 4 — O DIFERENCIAL: CITATIONS CLICAVEIS — 2:10 a 3:00

**Cena:** Resposta finalizada na tela. Foco nos badges de citacao.

**Ação:**
1. Clica num badge [1] — abre dialog/modal
2. Mostra o snippet exato do PDF que foi usado
3. Fecha o dialog
4. Clica em outro badge pra mostrar que cada um e diferente

**Fala:**
> "Essa parte aqui e onde a maioria das demos de RAG falha. Olha — clico no badge UM e abre exatamente o trecho do PDF que a IA usou pra responder. Voce nao precisa confiar cego no modelo, voce CONFERE."
>
> "Pra cliente que precisa auditar resposta — area juridica, compliance, financeiro — isso nao e bonito, e obrigatorio."

---

## CENA 5 — MULTI-TENANT + STACK (super rapido) — 3:00 a 3:30

**Cena:** Pode mostrar a URL na barra, ou voltar pro dashboard.

**Fala:**
> "Coisa importante que nao da pra ver mas ta ali: cada chunk e isolado por usuario no banco. Se eu logo com outra conta, nao vejo NADA do que voce subiu. Multi-tenant de verdade, nao no app, no banco."
>
> "Stack rapido pra quem curte tecnico: Next.js 14, Clerk pra auth, Postgres com pgvector na Neon, Gemini pro LLM e embedding, deploy na Vercel. Tudo pronto pra escalar quando trocar pro plano pago."

---

## CLOSING / CTA — 3:30 a 3:45 (ULTIMOS 15s)

**Cena:** Webcam maior, tela com a landing page ou um cartao com seus contatos.

**Fala:**
> "Esse projeto saiu do zero ate produção em poucos dias. Se voce precisa de algo parecido — RAG, chat com documento, SaaS com auth e billing — me chama. Link do meu perfil do Upwork e LinkedIn ta na descricao do video. Valeu!"

**Ação:** Sorri, acena, para a gravacao.

---

## DESCRIÇÃO DO LOOM (cola na descricao do video)

> ChatDocs — RAG SaaS demo (3min). Stack: Next.js 14, Clerk, pgvector, Gemini, Vercel.
> Live: https://chatdocs-git-main-rafaelasantosfeitosas-projects.vercel.app
> Upwork: [PLACEHOLDER — colar link]
> LinkedIn: [PLACEHOLDER — colar link]
> GitHub: [PLACEHOLDER — colar link do repo se publico]

---

## B-ROLL EXTRA (se sobrar tempo OU pra v2 do video)

Grava em separado e tem na manga caso queira refazer com edicao depois: close-up do dialog de citacao abrindo (camera lenta no hover do badge), close da barra de progresso do upload subindo de 0 a 100%, screenshot do schema do Postgres mostrando a coluna `embedding vector(768)` e o filtro `WHERE user_id = ...`, e um plano rapido do dashboard da Vercel mostrando o deploy verde com tempo de build. Esses clips servem pra cortar entre as cenas se voce decidir editar uma versao 2 — mas pro take unico do Loom free, NAO precisa: o fluxo linear ja vende. Use B-roll so se for refilmar pro YouTube ou portfolio site depois.
