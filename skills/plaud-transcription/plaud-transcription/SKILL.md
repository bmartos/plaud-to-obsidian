---
name: plaud-transcription
description: Gerenciamento e otimização de transcrições do Plaud. Especializado em transformar áudios brutos e reuniões estratégicas complexas em notas estruturadas no Obsidian com análise de decisões, stakeholders e stack tecnológica.
---

# Plaud Transcription Skill (Richer Model)

Esta skill fornece diretrizes e ferramentas para capturar, processar e organizar transcrições do Plaud no Obsidian de forma profissional, com foco em inteligência de negócios e reuniões estratégicas.

## 🤖 Agente Especializado
O **`plaud-agent`** é o executor principal desta skill. Ele deve aplicar lógica de processamento avançada para distinguir entre apresentações lineares e discussões dinâmicas.

## Lógica de Processamento Avançada

### 1. Segmentação Temática (Mapeamento de Capítulos)
Não processe o texto como um bloco único. Divida a transcrição em "Capítulos Lógicos" baseados na mudança de assunto (ex: Estratégia, Operacional, Tech/Dados, Q&A).

### 2. Extração de Entidades e Papéis
Identifique automaticamente:
- **Stakeholders:** Atribua autoridade e especialidade aos falantes (ex: "Speaker 3: Decisor de Negócio", "Speaker 10: Especialista em Arquitetura").
- **Stack Tecnológica:** Capture menções a sistemas, ferramentas e frameworks (ex: SAP, AWS, GPT, CRM).

### 3. Filtragem de Insight vs. Ruído
Diferencie o conteúdo core (decisões, KPIs, estratégias) do ruído de conversa (quebra-gelo, ajustes técnicos, conversas paralelas).

### 4. Log de Decisões e Pendências
Extraia decisões explícitas e implícitas, mapeando `Decisão | Responsável | Contexto`.

## Fluxo de Trabalho Recomendado

### 1. Preparação e Captura
- Siga as diretrizes em [best-practices.md](references/best-practices.md).
- Use `plaud list` para gravações sincronizadas ou identifique arquivos locais.

### 2. Processamento e Formatação
Utilize obrigatoriamente o template enriquecido em `assets/obsidian-template.md`.
- **Diarização Profissional:** Converta "Speaker X" para nomes reais se identificados no áudio.
- **Glossário Dinâmico:** Crie uma lista de termos técnicos específicos daquela reunião.

### 3. Organização
- **Nomenclatura:** `AAAA-MM-DD_Titulo_da_Nota.md`.
- **Diretório:** `C:\Users\bmart\AppData\Roaming\npm\node_modules\@google\gemini-cli\bundle\builtin\plaud-transcription\Obsidian\plaud` (ou conforme configurado).

## Transcrição Local (Whisper + Diarização)
A skill suporta processamento local com detecção automática de falantes baseada em timbre.

### Script de Transcrição
`C:\Python314\python.exe scripts/transcribe_local.py "caminho/do/audio.mp3"`

## Referências
- [best-practices.md](references/best-practices.md): Qualidade, Diarização e Segurança.
- [obsidian-template.md](assets/obsidian-template.md): Template enriquecido para reuniões complexas.
- [transcribe_local.py](scripts/transcribe_local.py): Script de motor local Whisper.
