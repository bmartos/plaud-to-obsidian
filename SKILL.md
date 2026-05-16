---
name: plaud-transcription
description: Gerenciamento e otimização de transcrições do Plaud. Especializado em transformar reuniões estratégicas complexas em notas estruturadas no Obsidian com análise de decisões, stakeholders e stack tecnológica.
---

# Plaud Transcription Skill (Richer Model)

Esta skill fornece diretrizes e ferramentas para capturar, processar e organizar transcrições do Plaud no Obsidian de forma profissional, com foco em inteligência de negócios.

## 🤖 Agente Especializado
O **`plaud-agent`** utiliza lógica avançada para processar discussões dinâmicas, extraindo mais do que apenas um resumo.

## Lógica de Processamento Avançada

### 1. Segmentação Temática
Divida a transcrição em blocos lógicos (Estratégia, Operacional, Tech, etc.).

### 2. Extração de Entidades e Papéis
- **Stakeholders:** Identifique quem decide e quem executa.
- **Stack Tecnológica:** Mapeie sistemas e ferramentas citados.

### 3. Log de Decisões
Extraia decisões explícitas e implícitas no formato `Decisão | Responsável | Contexto`.

## Fluxo de Trabalho Recomendado

### 1. Preparação e Captura
- Use `plaud list` ou arquivos locais. Siga as [best-practices.md](best-practices.md).

### 2. Processamento e Formatação
Utilize o template em `obsidian-template.md`. O agente deve realizar a filtragem de "Insight vs. Ruído" e gerar o glossário dinâmico.
- **MANDATÓRIO (Análise Estruturada):** Ao processar e resumir arquivos já transcritos (ex: movendo de `raw/` para a pasta principal), você DEVE **sempre anexar a transcrição bruta completa** no final do arquivo gerado, sob o cabeçalho "## 📝 Transcrição Completa". A nota final no Obsidian precisa ser autossuficiente (resumo + log original).
- Após salvar a nota estruturada, atualize o banco de dados (`scripts/db_manager.py update`) com `{"id": "...", "analyzed": 1, "final_path": "..."}`.

### 3. Geração de Nota Condicional (Regra de Ouro)
- **NUNCA** gere um arquivo `.md` no diretório final do Obsidian (`antigravity/Obsidian/plaud`) se a transcrição não tiver sido realizada com sucesso.
- Se o Plaud retornar "No transcript available" ou se o processamento local falhar, interrompa o fluxo e informe o usuário. Notas vazias ou apenas com metadados são proibidas.

### 4. Organização
- Salve em: `C:\Users\bmart\.antigravity\Obsidian\plaud`.

## Transcrição Local (Whisper + Diarização)
Utilize o comando: `plaud transcribe-local "caminho/do/audio.mp3"`

## Referências
- [best-practices.md](best-practices.md): Qualidade e Diarização.
- [obsidian-template.md](obsidian-template.md): Template enriquecido.
