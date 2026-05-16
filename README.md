# Plaud Professional Workflow

Automação ponta a ponta para gestão de áudios do Plaud, transcrição (API/Local) e análise estruturada no Obsidian.

## 🚀 Funcionalidades
- **Workflow Unificado**: Download, Transcrição, Análise e Publicação.
- **SQLite Database**: Controle de estado transacional para evitar processamento duplicado.
- **Transcrição Híbrida**: Usa a API do Plaud ou motor local **Whisper (faster-whisper)**.
- **Diarização de Falantes**: Detecção automática de locutores por timbre de voz no modo local.
- **Segurança**: Gestão de tokens via variáveis de ambiente (`.env`).
- **Obsidian Ready**: Organização automática de arquivos RAW e Resumos Estruturados.

## 🛠️ Configuração Inicial

1. **Instale as dependências**:
   ```bash
   npm install
   pip install faster-whisper speechbrain scikit-learn torchaudio
   ```

2. **Configure o Ambiente**:
   Copie o arquivo `.env.example` para `.env` e preencha suas credenciais:
   ```bash
   cp .env.example .env
   ```

3. **Inicie o Workflow**:
   Use o agente Gemini CLI:
   > @plaud-workflow sincronize meu Plaud

## 🗄️ Estrutura do Projeto
- `scripts/db_manager.py`: Interface com o banco SQLite.
- `scripts/transcribe_local.py`: Motor de transcrição Whisper Local.
- `packages/`: Código fonte do toolkit (CLI, Core, MCP).
- `.gemini/agents/`: Definição do agente especializado de workflow.
