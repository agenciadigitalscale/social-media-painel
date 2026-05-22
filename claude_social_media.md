

 # 🚀 CLAUDE.MD — Projeto: Painel Social Media
**Digital Scale · Agência de Marketing Digital**
*Documento de contexto para continuação do projeto em novas conversas*

---

## 📌 VISÃO GERAL DO PROJETO

**O que é:** Painel operacional completo para a funcionária de Social Media da Digital Scale gerenciar todos os clientes, agendamentos, status de publicação e links de conteúdo em um único lugar — substituindo múltiplas planilhas abertas em abas separadas.

**Problema resolvido:** A Social Media abria entre 17 e 20 abas por dia (uma planilha por cliente) para checar o que publicar. Perdia tempo operacional em vez de produzir conteúdo.

**Solução entregue:** App HTML standalone (dark mode, mobile-first) conectado ao Google Sheets via Apps Script para persistência de dados em tempo real.

---

## 🏗️ ARQUITETURA TÉCNICA

### Arquivo principal
- **`digital_scale_social_media.html`** — App completo em arquivo único HTML/CSS/JS
- Abre no Chrome → "Adicionar à tela inicial" → funciona como app no celular
- Ou hospedado no Netlify → URL pública acessível de qualquer dispositivo

### Persistência de dados (dupla camada)
| Camada | Tecnologia | Função |
|---|---|---|
| Primária | Google Sheets + Apps Script | Sincronização em nuvem, multi-dispositivo |
| Fallback | localStorage | Funciona offline, não perde dados |

### Google Sheets
- **Planilha criada:** `Digital Scale — Painel Social Media (Dados)`
- **ID:** `1POsi3OJE6Eq7esIvwaCPlxaCFAvRH6lOX8C3qfY_l9s`
- **URL:** `https://docs.google.com/spreadsheets/d/1POsi3OJE6Eq7esIvwaCPlxaCFAvRH6lOX8C3qfY_l9s`
- **Aba de dados:** `SM_Data`
- **Colunas:** ID · Status · Link · Legenda · Observacao · Atualizado

### Apps Script (endpoint)
- **URL de produção:** `https://script.google.com/macros/s/AKfycbzj9pUbAtnr85xO3QGpy-PheV9MRAgZZ5ErxdXOLBq8OhKuv7CZ5vf9LWFC-23oiqLS9Q/exec`
- **Método GET:** Lê todos os dados (`?action=read` ou sem parâmetros → retorna JSON com todos os itens)
- **Método POST:** Salva item individual (body JSON com id, status, link, cap, notes)
- **Arquivo do código:** `apps_script_digital_scale.js`

---

## 🎨 IDENTIDADE VISUAL

| Elemento | Valor |
|---|---|
| Cor primária (laranja) | `#FF6B00` |
| Laranja claro | `#FF8C38` |
| Preto fundo | `#0A0A0A` |
| Preto card | `#181818` |
| Amarelo | `#FFD700` |
| Verde (publicado) | `#00C47A` |
| Vermelho (atrasado) | `#FF4545` |
| Azul (em aprovação) | `#3B8EFF` |
| Fonte | Inter (Google Fonts) + system-ui fallback |
| Logo | Embedded em base64 no HTML (arquivo `Sem-Título-1.png`) |

**Estilo:** Dark mode total, glow effects laranja, cards com gradiente interno, animação pulse nos atrasados, fade-in nas seções.

---

## 📊 DADOS DOS CLIENTES (Maio 2026)

### 17 clientes ativos — 224 conteúdos no mês

| Cliente | Posts/mês | Reels/mês | Planilha Drive | Roteiro Drive |
|---|---|---|---|---|
| Casa de Ração 2 Irmãos | 4 | 4 | — | ✅ (2 roteiros) |
| Chalés Alto da Represa | 4 | 4 | — | ✅ |
| Frango d'Água | 8 | 4 | ✅ | ✅ |
| Garden Eventos | 4 | 4 | — | — |
| Hidro Elétrica Andrade | 4 | 4 | — | ✅ |
| Home Elevadores | 8 | 8 | — | ✅ |
| Kátia Bigatello | 4 | 6 | — | — |
| Lareiras Grill | 8 | 8 | ✅ | ✅ |
| LuzioPan | 8 | 8 | — | ✅ |
| Magia dos Temáticos | 6 | 6 | — | — |
| Padaria R.A | 4 | 4 | — | ✅ |
| Pousada Dukuka | 4 | 4 | — | — |
| Quero Bolo | 4 | 4 | — | — |
| Rest. Lambari | 8 | 4 | ✅ | ✅ |
| Suh Maya | 4 | 4 | — | ✅ |
| ViniPlas | 8 | 8 | ✅ | ✅ |
| Rosângela Varas | 4 | 4 | — | ✅ |

### Links de Drive por cliente (mapeados)
```javascript
// Planilhas de organização
Frango d'Água:    spreadsheets/d/12f_iPJU9ACXasOB7ZYcw3OKyw1ookXMU5gBqJnEfUss
Lareiras Grill:   spreadsheets/d/1atr9jVLvTQIZbeMVqu6DMuJjssfZ4Gxv_fDo1XJfXA8
Rest. Lambari:    spreadsheets/d/1TbUO25NcXR2hJRs4A2TvNyR9HJjNPZTaxuE7-fVYlnU
ViniPlas:         spreadsheets/d/1zXLyWtgQwVEf-XmkV2EgYjFMBLfwTqMMO1jJgzVQK0o

// Roteiros (documentos)
Casa de Ração 2 Irmãos:  document/d/1ZH7iWy4euc-... e document/d/1gVPZlYbg0rs...
Chalés Alto da Represa:  document/d/1o7wWGmNZ7qr...
Frango d'Água:           document/d/1SqUxJPFdeQg...
Hidro Elétrica Andrade:  document/d/1HQcqOONfYhG...
Home Elevadores:         document/d/11sa7aE8LGyo...
Lareiras Grill:          document/d/17T3Rxw2bQRC...
LuzioPan:                document/d/1dZqL-WRoARK...
Padaria R.A:             document/d/1CD7LIhgeT4a...
Rest. Lambari:           document/d/1EAW0_e6qu27...
Suh Maya / Rosângela:    document/d/1kHUnUiWg171...
ViniPlas:                document/d/14xuGrLqay6I...
```

---

## ⚙️ ESTRUTURA DO APP

### Abas do painel
1. **🏠 Hoje** — Atrasados (pulsando vermelho) + Publicar hoje + Gerador de resumo
2. **📅 Agenda** — Próximos 7 ou 15 dias com filtro por cliente e tipo
3. **🗓 Calendário** — Visão mensal com contagem de posts e clientes por dia, navegação por mês
4. **🏢 Clientes** — Cards com barras de progresso Posts/Reels + links do Drive

### Sistema de status (4 etapas)
| Ícone | Status | Cor |
|---|---|---|
| ○ | Pendente | Cinza |
| ✎ | Em edição | Amarelo |
| ✓ | Aprovado | Azul |
| ✔ | Publicado | Verde |

### Por item expandido
- Campo de link Drive individual (editável)
- Campo de legenda/copy (textarea)
- Campo de observações (textarea)
- Pills de status para avançar etapa
- Links rápidos para planilha e roteiro do cliente

### Funcionalidades extras
- Saudação dinâmica (☀️ Bom dia / 🌤 Boa tarde / 🌙 Boa noite) com relógio em tempo real
- Filtro por cliente (pill bar horizontal scrollável)
- Filtro por tipo: Todos / Posts / Reels / Em edição
- Pulse animation vermelho nos itens atrasados
- Notificação às 7h pelo navegador (requer permissão)
- Gerador de resumo diário com botão de copiar para WhatsApp
- Sincronização em background ao abrir e ao modificar qualquer item

---

## 🗂️ ESTRUTURA DE DADOS (JavaScript)

### Objeto de item de conteúdo
```javascript
{
  i: 1,                          // ID único (1–187)
  c: 'Nome do Cliente',          // string
  dt: new Date(2026,4,16),       // objeto Date
  tp: 'Post' | 'Reel',          // tipo de conteúdo
  n: 'Nome do conteúdo',        // título/nome
  s: 0 | 1 | 2 | 3              // status inicial (0=pendente, 3=publicado)
}
```

### Estados em memória
```javascript
ST = {}   // { [id]: 0|1|2|3 }      status de cada item
LK = {}   // { [id]: 'url' }         link Drive por item
CP = {}   // { [id]: 'texto' }       legenda/copy
NT = {}   // { [id]: 'texto' }       observações
```

---

## 📅 CONTEXTO TEMPORAL

- **Data base do painel:** Sábado, 16 de Maio de 2026
- **Mês de referência:** Maio 2026 (Semanas 1–5)
- **IDs de conteúdo:** 1 a 187 (187 itens totais no mês)
- **Atualização mensal:** Para junho, substituir os dados do array DATA e ajustar a data base `T`

---

## 🔄 COMO ATUALIZAR PARA O PRÓXIMO MÊS

1. Abrir o arquivo HTML em editor de texto
2. Localizar `const T=new Date(2026,4,16)` → alterar para o 1º dia do novo mês
3. Localizar `const DATA=[...]` → substituir pelos dados do mês novo
4. Localizar `cY=2026,cM=4` → atualizar ano e mês (mês começa em 0: jan=0, mai=4, jun=5)
5. Salvar e redistribuir

**Ou:** Pedir ao Claude para atualizar automaticamente com as novas planilhas dos clientes.

---

## 📁 ARQUIVOS DO PROJETO

| Arquivo | Descrição |
|---|---|
| `digital_scale_social_media.html` | App completo (arquivo principal) |
| `apps_script_digital_scale.js` | Código para colar no Apps Script do Google |
| `claude_social_media.md` | Este arquivo de contexto |
| `memoria_kaique_digital_scale.md` | Memória geral da agência e clientes |

---

## 🚧 MELHORIAS PLANEJADAS / PRÓXIMOS PASSOS

- [ ] **Painel do Editor de Vídeo** — próximo painel a ser criado
- [ ] **Painel do Gestor de Tráfego** — para gestão de anúncios
- [ ] **Painel do Kaique (visão geral)** — dashboard executivo com todos os funcionários
- [ ] **Atualização automática mensal** — script que gera o novo mês a partir das planilhas
- [ ] **Hospedagem no Netlify** — URL fixa para acesso sem baixar arquivo
- [ ] **Integração WhatsApp** — notificação automática via WhatsApp Business

---

## 💬 COMO RETOMAR ESTE PROJETO COM O CLAUDE

Cole esta instrução no início da próxima conversa:

> "Estou continuando o projeto do **Painel Social Media da Digital Scale**. Leia o arquivo claude_social_media.md para ter o contexto completo. Quero [descreva o que quer fazer]."

E anexe este arquivo `claude_social_media.md` na conversa.

---

*Gerado por Claude Sonnet | Digital Scale | Maio 2026*
*Kaique — Digital Scale · Marketing Digital*
