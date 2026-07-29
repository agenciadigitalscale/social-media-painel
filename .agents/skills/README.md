# Skills do Workspace

Este workspace já tem duas skills locais instaladas:

- `frontend-design`
  - Use para criar ou revisar interfaces web com atenção ao design, tipografia, cor, animação e consistência visual.
- `pptx`
  - Use para qualquer trabalho envolvendo arquivos `.pptx`, apresentações ou edição de slides.

---

## Skills recomendadas para melhorar seu fluxo

### 1. frontend-design
- Já está instalada.
- Use sempre que você quiser melhorar o visual do painel, criar componentes mais polidos ou ajustar layouts.

### 2. find-skills
- Serve para buscar outras skills úteis por palavra-chave.
- Ideal para descobrir o melhor skill para a tarefa que você tem em mente.

### 3. agent-customization
- Útil para criar, ajustar ou instalar skills personalizadas no workspace.
- Facilita a gestão de prompts, regras e templates.

### 4. project-setup-info-local
- Ajuda a criar novos projetos e estruturar o workspace.
- Bom para scaffolding e organização de pastas.

### 5. python-fact-grounded-coding
- Excelente para desenvolvimento Python com diagnóstico real do código e uso de Pylance.
- Útil se você precisar depurar ou ajustar scripts ou back-end em Python.

### 6. design-system
- Ajuda a revisar consistência visual e regras de design.
- Ideal para um projeto UI pesado como este.

---

## Como instalar uma skill do GitHub

1. Escolha o repositório da skill no GitHub.
2. Baixe ou clone o conteúdo para uma pasta nova dentro de `.agents/skills/`.

Exemplo:

```powershell
cd "c:\Users\Digital Scale\OneDrive\Documentos\projetos\Social media"
git clone https://github.com/<owner>/<skill-repo>.git .agents/skills/<skill-name>
```

3. Verifique se o diretório criado contém `SKILL.md`.
4. Reinicie o VS Code ou recarregue a extensão Copilot Chat para que a skill seja detectada.

---

## Exemplo de instalação manual

Se você baixar um ZIP do GitHub, extraia para:

```text
.agents/skills/<skill-name>/
  SKILL.md
  prompt.md
  .agent.md
  LICENSE.txt
  ...
```

---

## Como usar uma skill no Copilot Chat

- Ao pedir algo, mencione diretamente a skill: `Use o skill frontend-design para ...`.
- Exemplo:
  - `Use o skill frontend-design para refatorar o componente de cards com uma interface mais premium.`
  - `Use o skill pypance-refactoring para ajustar este arquivo Python.`

- Se o Copilot Chat tiver interface de seleção de skill, escolha a skill relevante antes de enviar a pergunta.

---

## Dicas rápidas

- Para design de UI, use `frontend-design`.
- Para projetos ou setup local, use `project-setup-info-local`.
- Para ajustar prompt/skills personalizados, use `agent-customization`.
- Para obter recomendações de skills por palavra-chave, use `find-skills`.

---

## Observação

Skills locais são carregadas a partir de `.agents/skills/`. Se não aparecer depois de instalar, reinicie o VS Code.
