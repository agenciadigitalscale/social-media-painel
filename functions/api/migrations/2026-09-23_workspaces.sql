-- Onda 1a do "DS HUB vendável": a tabela de tenants (agências).
--
-- INERTE por enquanto: nenhum endpoint lê esta tabela ainda. Ela é o registro de
-- quais agências existem, com a marca (white-label) e o plano de cada uma. O
-- workspace nº 1, 'digital-scale', é semeado como dono (plano 'owner', sem
-- limite) — e as chaves dele NÃO ganham prefixo (ver scopedKey em
-- _lib/workspace.ts), então os dados atuais continuam válidos sem migração.
--
-- Aplicar no D1 é ato separado do deploy do Pages (ver CLAUDE.md). Rodar com:
--   npx wrangler d1 execute <DB> --file functions/api/migrations/2026-09-23_workspaces.sql

CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,               -- slug seguro: 'digital-scale'
  name       TEXT NOT NULL,                  -- exibição: 'Digital Scale'
  brand      TEXT NOT NULL DEFAULT '{}',     -- JSON white-label: logo, cores, etc.
  plan       TEXT NOT NULL DEFAULT 'free',   -- free | pro | owner
  status     TEXT NOT NULL DEFAULT 'active', -- active | trial | suspended
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- O tenant nº 1. OR IGNORE torna a migração idempotente (rodar duas vezes não erra).
INSERT OR IGNORE INTO workspaces (id, name, plan, status)
VALUES ('digital-scale', 'Digital Scale', 'owner', 'active');
