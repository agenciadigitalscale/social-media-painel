Execute o checklist completo antes de fazer deploy do DS HUB.

## 1. Build de produção
```bash
npm run build
```
Se falhar: mostre os erros TypeScript e corrija antes de continuar.

## 2. Verificações automáticas de código

Verifique os arquivos modificados desde o último commit por:

**Erros críticos:**
- `any` implícito em TypeScript
- `backdropFilter: blur()` em componentes dentro de `DndContext` ou com `useDraggable` (trava GPU)
- `console.log` esquecido
- Imports não usados que podem causar erro de build
- `hardcoded` IDs de status (deve usar `STATUS_CONFIG`)
- Cores de usuário hardcoded (deve usar `NAME_MAP`)

**Checklist de ambiente:**
- `wrangler.toml` não foi alterado com credenciais expostas?
- `.env` não está sendo comitado?
- Service Worker (`public/sw.js`) atualizado se houve mudança de rota?

## 3. Git status
Mostre o que será enviado: arquivos modificados, novos e deletados.

## 4. Resultado

Se tudo OK:
```
✅ Build limpo
✅ Sem erros TypeScript  
✅ Sem problemas de performance
✅ Pronto para: git push origin main
```

Se houver problemas:
```
🔴 Bloqueadores — corrigir antes do deploy
🟡 Avisos — verificar se intencional
```

Após o checklist, pergunte: "Quer que eu faça o commit e push agora?"
