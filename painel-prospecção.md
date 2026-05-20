# Painel de Prospecção — Nicho Gastronômico
**Digital Scale · Agência de Marketing Digital**

---

## Visão Geral

Aplicativo separado e independente para a equipe comercial da Digital Scale encontrar, cadastrar e acompanhar estabelecimentos do nicho gastronômico que são potenciais clientes de social media.

**Objetivo:** Ter em um único lugar todos os leads gastronômicos com seus status de prospecção, histórico de contatos e informações relevantes para facilitar a abordagem comercial.

**Usuários:** Equipe comercial / Kaique (gestor da agência)

---

## Stack Recomendada

Mesma stack do painel de social media para consistência e reuso de conhecimento:

- **Frontend:** React 18 + TypeScript + Vite + MUI v6
- **Backend:** Cloudflare Pages Functions (Workers)
- **Banco:** Cloudflare D1 (SQLite no edge)
- **Deploy:** GitHub → Cloudflare Pages
- **Tema:** Dark mode, mesma identidade visual da Digital Scale

---

## Estrutura de Diretórios (novo repositório)

```
painel-prospeccao/
├── src/
│   ├── App.tsx              # Root — header, tabs, busca global
│   ├── main.tsx             # Entry point
│   ├── theme.ts             # Tema MUI dark (idêntico ao social media)
│   ├── types.ts             # Lead, Interaction, NicheCategory
│   ├── data.ts              # NICHE_CATEGORIES[], STATUS_LABELS[]
│   └── components/
│       ├── LeadCard.tsx     # Card expansível do lead
│       ├── StatusChip.tsx   # Chip de status de prospecção
│       ├── LeadsTab.tsx     # Aba principal: lista de leads com filtros
│       ├── KanbanTab.tsx    # Funil visual (futuro)
│       └── StatsTab.tsx     # Métricas (futuro)
├── functions/
│   └── api/
│       ├── leads.ts         # GET/POST/DELETE leads no D1
│       └── schema.sql       # DDL: tabela leads + interactions
├── index.html
├── vite.config.ts
├── wrangler.toml
├── tsconfig.json
└── package.json
```

---

## Tipos TypeScript (src/types.ts)

```typescript
type ProspectStatus =
  | 'novo'          // 0 — Lead identificado, ainda não contatado
  | 'contato'       // 1 — Primeiro contato feito (DM, ligação, visita)
  | 'negociando'    // 2 — Proposta enviada / em negociação
  | 'fechado'       // 3 — Virou cliente
  | 'perdido'       // 4 — Não tinha interesse / perdido

type NicheCategory =
  | 'Restaurante'
  | 'Pizzaria'
  | 'Hamburgueria'
  | 'Padaria & Confeitaria'
  | 'Bar & Boteco'
  | 'Cafeteria'
  | 'Sorveteria'
  | 'Lanchonete'
  | 'Churrascaria'
  | 'Delivery'
  | 'Food Truck'
  | 'Outro'

interface Lead {
  id: string                    // UUID gerado no cadastro
  name: string                  // Nome do estabelecimento
  category: NicheCategory
  city: string
  neighborhood?: string
  phone?: string
  instagram?: string            // @handle sem o @
  responsible?: string          // Nome do dono/responsável
  status: ProspectStatus
  priority: 'alta' | 'media' | 'baixa'
  notes: string                 // Observações gerais
  monthlyBudget?: string        // Estimativa de ticket (ex: "R$800-1200/mês")
  followers?: number            // Seguidores no Instagram (para qualificar)
  lastContact?: Date
  nextFollowUp?: Date
  createdAt: Date
  updatedAt: Date
}

interface Interaction {
  id: string
  leadId: string
  date: Date
  channel: 'DM' | 'Ligação' | 'Email' | 'Visita' | 'Outro'
  summary: string               // O que foi discutido
  outcome: 'positivo' | 'neutro' | 'negativo'
}
```

---

## Sistema de Status de Prospecção

| Status | Label | Cor MUI | Descrição |
|---|---|---|---|
| `novo` | Novo Lead | default (outlined) | Identificado, aguardando abordagem |
| `contato` | Contato Feito | warning | Primeiro contato realizado |
| `negociando` | Negociando | info | Proposta em andamento |
| `fechado` | Fechado ✓ | success | Virou cliente da agência |
| `perdido` | Perdido | error | Sem interesse ou proposta recusada |

---

## Funcionalidades — Home (LeadsTab)

A aba principal é a lista de leads — o coração do painel.

### Listagem de Leads

- Cards expansíveis por lead (similar ao `ContentCard` do social media)
- Ordenação padrão: priority (alta → baixa) + data de follow-up
- Ao expandir: phone, instagram, notes, histórico de interações, botões de ação

### Filtros (topo da página)

```
[Busca por nome/cidade/bairro]  [Categoria ▼]  [Status ▼]  [Prioridade ▼]  [+ Novo Lead]
```

- Busca fuzzy em tempo real (nome, cidade, bairro, responsável)
- Filtro por `NicheCategory` (restaurante, padaria, bar, etc.)
- Filtro por `ProspectStatus`
- Filtro por prioridade

### Card do Lead (LeadCard)

**Fechado (collapsed):**
```
[Avatar inicial] Nome do Estabelecimento          [StatusChip]  [Prioridade]
                 Restaurante · São Paulo · @instagram
                 Último contato: 15/05/2026 · Follow-up: 22/05/2026
```

**Aberto (expanded):**
```
CONTATO                          QUALIFICAÇÃO
Telefone: (11) 99999-9999       Seguidores: 4.200
Instagram: @nomerestaurante     Budget estimado: R$800-1.200/mês
Responsável: João Silva         Prioridade: Alta

OBSERVAÇÕES
[campo de notas editável inline]

HISTÓRICO DE INTERAÇÕES
  15/05 · DM · "Interesse em orçamento, pediu para ligar semana que vem" · 🟢 Positivo
  10/05 · Ligação · "Não atendeu, deixei mensagem" · 🟡 Neutro
  [+ Registrar Interação]

[Mudar Status ▼]  [Editar]  [Arquivar]
```

### Modal: Novo Lead / Editar Lead

Campos:
- Nome do estabelecimento (obrigatório)
- Categoria (select)
- Cidade (obrigatório)
- Bairro
- Telefone
- Instagram (@handle)
- Nome do responsável
- Status inicial (padrão: `novo`)
- Prioridade (padrão: `media`)
- Budget estimado
- Seguidores Instagram
- Data do próximo follow-up
- Notas livres

### Modal: Registrar Interação

- Canal: DM / Ligação / Email / Visita / Outro
- Data (padrão: hoje)
- Resumo do que foi discutido
- Resultado: Positivo / Neutro / Negativo

---

## Banco de Dados D1 (schema.sql)

```sql
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT,
  phone TEXT,
  instagram TEXT,
  responsible TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  priority TEXT NOT NULL DEFAULT 'media',
  notes TEXT DEFAULT '',
  monthly_budget TEXT,
  followers INTEGER,
  last_contact TEXT,
  next_follow_up TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  channel TEXT NOT NULL,
  summary TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id);
```

---

## API Cloudflare (functions/api/leads.ts)

| Método | Path | Descrição |
|---|---|---|
| GET | /api/leads | Lista todos os leads (com filtros via query params) |
| POST | /api/leads | Criar novo lead |
| PUT | /api/leads/:id | Atualizar lead |
| DELETE | /api/leads/:id | Arquivar lead |
| GET | /api/leads/:id/interactions | Listar interações de um lead |
| POST | /api/leads/:id/interactions | Registrar nova interação |

**Filtros GET /api/leads:**
```
?status=novo&category=Restaurante&city=São Paulo&priority=alta&search=pizzaria
```

---

## Persistência

- **D1 como fonte única** (sem localStorage) — dados comerciais precisam de consistência entre dispositivos
- Carregamento inicial: fetch de todos os leads ao montar o app
- Mutations otimistas: atualiza UI antes da confirmação do servidor

---

## Categorias Gastronômicas Prioritárias

Nichos com maior potencial para social media na região:

| Categoria | Por quê prospectar |
|---|---|
| Restaurantes | Alto ticket, frequência diária de posts, cardápio dinâmico |
| Padarias & Confeitarias | Conteúdo visual rico (bolos, pães), stories de bastidores |
| Hamburguerias | Nicho aspiracional, lançamentos frequentes de burgers |
| Pizzarias | Delivery forte, promoções semanais |
| Bares & Botecos | Eventos, happy hour, público engajado |
| Cafeterias | Estética forte, comunidade de café, morning posts |
| Churrascarias | Conteúdo premium, diferenciais visuais |

---

## Campos de Qualificação do Lead

Para priorizar quem abordar primeiro:

| Campo | Peso | Critério |
|---|---|---|
| Seguidores Instagram | Alto | Já investe em presença digital → mais fácil vender |
| Sem agência | Alto | Verificar bio/posts — conteúdo amador = oportunidade |
| Localização | Médio | Proximidade facilita visitas e relacionamento |
| Categoria | Médio | Nichos com maior ROI para social media |
| Ticket estimado | Alto | Budget compatível com os planos da agência |

---

## Próximos Passos

**v1 — MVP (Home)**
- [x] Especificação (este arquivo)
- [ ] Criar repositório `painel-prospeccao`
- [ ] Configurar stack (React + Vite + MUI + Cloudflare)
- [ ] Implementar `LeadsTab` com lista, filtros e `LeadCard`
- [ ] API D1: CRUD completo de leads
- [ ] Modal de novo lead e edição
- [ ] Registro de interações

**v2 — Funil**
- [ ] `KanbanTab`: arraste leads entre colunas de status
- [ ] Visualização de pipeline com contagem por coluna

**v3 — Métricas**
- [ ] `StatsTab`: taxa de conversão, leads por categoria, tempo médio de fechamento
- [ ] Relatório mensal de prospecção

**v4 — Inteligência**
- [ ] Sugestão automática de leads (Instagram scraping ou Google Maps)
- [ ] Lembretes de follow-up (notificação push)
- [ ] Integração: ao fechar um lead, criar o cliente no painel de social media
