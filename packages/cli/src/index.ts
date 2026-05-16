import { loginCommand } from './commands/login.js';
import { listCommand } from './commands/list.js';
import { downloadCommand } from './commands/download.js';
import { transcriptCommand } from './commands/transcript.js';
import { syncCommand } from './commands/sync.js';
import { transcribeLocalCommand } from './commands/transcribe-local.js';

const VERSION = '0.1.0';

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  login: loginCommand,
  list: listCommand,
  download: downloadCommand,
  transcript: transcriptCommand,
  sync: syncCommand,
  'transcribe-local': transcribeLocalCommand,
};

export async function run(args: string[]): Promise<void> {
  const cmd = args[0];

  if (cmd === '--version' || cmd === '-v') {
    console.log(`Plaud Toolkit v${VERSION}`);
    return;
  }

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printUsage();
    return;
  }

  const handler = COMMANDS[cmd];
  if (!handler) {
    console.error(`Unknown command: ${cmd}`);
    printUsage();
    process.exit(1);
  }

  try {
    await handler(args.slice(1));
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
Plaud Toolkit v${VERSION}
Usage: plaud <command> [options]

Commands:
  login                 Authenticate with Plaud (Token capture)
  list                  List all recordings
  download <id> [dir]   Download audio file (streaming)
  transcript <id>            Print recording transcript
  sync <folder>              Sync new recordings to Obsidian markdown
  transcribe-local <file>    Transcribe local audio with diarization

Options:
  -v, --version         Show version
  -h, --help            Show this help
  `);
}
