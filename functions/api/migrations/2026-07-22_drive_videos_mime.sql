-- Criativo estático na Inbox: até aqui o scan só indexava `video/*`, e a
-- presença (a varredura completa que prova se o arquivo continua na pasta)
-- também. Resultado: imagem vinculada pela coluna Pronto era lida como
-- "removida da pasta" na varredura seguinte e o card perdia a prévia.
--
-- Na prática a Function já se vira sozinha: `ensureColumn` (_lib/schema-guard)
-- cria a coluna no primeiro scan se ela não existir, porque deploy e migração
-- são atos separados e o intervalo entre eles congelaria a Inbox. Este arquivo
-- fica como registro e como caminho manual.
--
-- Roda UMA vez. Repetir dá "duplicate column name" — é inofensivo, mas é sinal
-- de que já foi aplicada.
--
--   npx wrangler d1 execute social-media-db --remote \
--     --file functions/api/migrations/2026-07-22_drive_videos_mime.sql
--
-- Sem `--remote` o comando bate no banco local do wrangler, não em produção.

ALTER TABLE drive_videos ADD COLUMN mime_type TEXT;
