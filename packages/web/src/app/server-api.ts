'use server';

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { headers } from 'next/headers';

const execAsync = promisify(exec);

const OFFICIAL_PLAUD_PATH = process.env.OFFICIAL_PLAUD_PATH || 'C:\\Users\\bmart\\AppData\\Roaming\\npm\\plaud.cmd';
const DB_PATH = process.env.DATABASE_URL?.replace('sqlite://', '') || './data/plaud_records.db';

export async function installPlaudCli() {
  try {
    const { stdout, stderr } = await execAsync('npm install -g @plaud-ai/cli');
    return { success: true, message: 'CLI instalado com sucesso!', details: stdout || stderr };
  } catch (error: any) {
    return { success: false, message: 'Falha ao instalar o CLI.', error: error.message };
  }
}

export async function loginPlaudCli() {
  // Capturar dinamicamente o host da requisição para redirecionamento correto pós-login
  let originUrl = 'http://localhost:3000';
  try {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    originUrl = `${protocol}://${host}`;
    console.log('[loginPlaudCli] Origem detectada para redirecionamento:', originUrl);
  } catch (err: any) {
    console.warn('[loginPlaudCli] Não foi possível ler os headers, usando fallback:', err.message);
  }

  // Limpar preventivamente qualquer token guardado em cache
  const tokensPath = path.join(os.homedir(), '.plaud', 'tokens.json');
  const configPath = path.join(os.homedir(), '.plaud', 'config.json');
  try {
    if (fs.existsSync(tokensPath)) fs.unlinkSync(tokensPath);
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    console.log('[loginPlaudCli] Cache de tokens limpo com sucesso.');
  } catch (err: any) {
    console.error('[loginPlaudCli] Erro ao limpar cache de tokens:', err.message);
  }

  return await new Promise((resolve) => {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const helperPath = path.join(projectRoot, 'scripts', 'login_helper.js');
    console.log('[loginPlaudCli] Executando helper de login em:', helperPath);
    
    const child = spawn('node', [helperPath, originUrl], { shell: true, env: process.env });
    let capturedUrl = '';
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      const urlMatch = output.match(/https?:\/\/[^\s]+/);
      if (urlMatch && !capturedUrl) {
        capturedUrl = urlMatch[0];
        console.log('[loginPlaudCli] URL capturada:', capturedUrl);
        resolve({ success: true, message: 'URL de autenticação gerada.', url: capturedUrl });
      }
    });

    child.stderr.on('data', (data) => {
      console.error('[loginPlaudCli] stderr:', data.toString());
    });

    setTimeout(() => { 
      if (!capturedUrl) {
        resolve({ success: true, message: 'Processo iniciado. Verifique o seu navegador ou console.' }); 
      }
    }, 10000);

    child.on('error', (err) => {
      console.error('[loginPlaudCli] error:', err);
      resolve({ success: false, message: 'Erro ao disparar login.', error: err.message });
    });
  });
}

export async function logoutPlaudCli() {
  try {
    const { stdout } = await execAsync(`"${OFFICIAL_PLAUD_PATH}" logout`);
    const tokensPath = path.join(os.homedir(), '.plaud', 'tokens.json');
    const configPath = path.join(os.homedir(), '.plaud', 'config.json');
    if (fs.existsSync(tokensPath)) fs.unlinkSync(tokensPath);
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    return { success: true, message: 'Logout realizado com sucesso!', details: stdout };
  } catch (error: any) {
    const tokensPath = path.join(os.homedir(), '.plaud', 'tokens.json');
    const configPath = path.join(os.homedir(), '.plaud', 'config.json');
    let deleted = false;
    if (fs.existsSync(tokensPath)) { fs.unlinkSync(tokensPath); deleted = true; }
    if (fs.existsSync(configPath)) { fs.unlinkSync(configPath); deleted = true; }
    if (deleted) {
      return { success: true, message: 'Logout manual realizado (CLI falhou).' };
    }
    return { success: false, message: 'Falha ao realizar logout.', error: error.message };
  }
}

export async function getPlaudUser() {
  try {
    const { stdout } = await execAsync(`"${OFFICIAL_PLAUD_PATH}" me`, { shell: 'cmd.exe' });
    const info: Record<string, string> = {};
    const lines = stdout.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('User Info')) return;
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(':').trim();
        if (key && value) {
          info[key] = value;
        }
      }
    });
    return {
      success: true,
      data: {
        id: info.id || '',
        email: info.email || '',
        nickname: info.nickname || 'Usuário Plaud',
        avatar: info.avatar || null
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function validatePlaudLogin() {
  try {
    const { stdout } = await execAsync(`"${OFFICIAL_PLAUD_PATH}" me`, { shell: 'cmd.exe', timeout: 15000 });
    const lowerStdout = stdout.toLowerCase();
    if (lowerStdout.includes('email:')) {
      const emailMatch = stdout.match(/email:\s*(.*)/i);
      const email = emailMatch ? emailMatch[1].trim() : 'Usuário Plaud';
      console.log('validatePlaudLogin returning:', { success: true, data: { email } });
      return { success: true, data: { email } };
    }
    console.log('validatePlaudLogin returning:', { success: false, message: 'O CLI não retornou informações do usuário.', details: stdout });
    return { success: false, message: 'O CLI não retornou informações do usuário.', details: stdout };
  } catch (e: any) {
    const outputCheck = (e.stdout || '') + (e.stderr || '');
    if (outputCheck.toLowerCase().includes('email:')) {
      const emailMatch = outputCheck.match(/email:\s*(.*)/i);
      const email = emailMatch ? emailMatch[1].trim() : 'Usuário Plaud';
      console.log('validatePlaudLogin returning:', { success: true, data: { email }, message: 'Login validado com avisos.' });
      return { success: true, data: { email }, message: 'Login validado com avisos.' };
    }
    const tokensPath = path.join(os.homedir(), '.plaud', 'tokens.json');
    const configPath = path.join(os.homedir(), '.plaud', 'config.json');
    const fileExists = fs.existsSync(tokensPath) || fs.existsSync(configPath);
    let errorMessage = 'Sessão inválida ou expirada.';
    if (outputCheck.toLowerCase().includes('auth_failed')) {
      errorMessage = 'Autenticação falhou na API do Plaud. Por favor, refaça o login.';
    } else if (e.code === 'ETIMEDOUT') {
      errorMessage = 'Tempo limite esgotado ao validar login. Tente novamente.';
    }
    console.log('validatePlaudLogin returning:', { success: false, message: errorMessage, details: e.stdout || e.message, fileExists });
    return {
      success: false,
      message: errorMessage,
      details: e.stdout || e.message,
      fileExists
    };
  }
}

export async function listRecordings() {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const scriptPath = path.join(projectRoot, 'scripts', 'db_manager.py');
    const dbPath = path.join(projectRoot, 'data', 'plaud_records.db');

    if (!fs.existsSync(dbPath)) {
      return { success: true, data: [] };
    }

    const { stdout } = await execAsync(`python "${scriptPath}" list`, {
      env: { ...process.env, DATABASE_URL: dbPath, PYTHONIOENCODING: 'utf-8' }
    });

    if (!stdout.trim()) {
      return { success: true, data: [] };
    }

    const rawRecords = JSON.parse(stdout);

    const recordings = rawRecords.map((r: any) => {
      const isSynced = r.downloaded === 1;
      return {
        id: r.id,
        filename: r.fullname || 'Sem Título',
        date_formatted: r.start_time ? r.start_time.split(' ')[0] : '',
        duration_text: r.duration || '',
        is_synced: isSynced,
        downloaded: r.downloaded,
        transcribed: r.transcribed,
        analyzed: r.analyzed,
        filesize_mb: r.filesize_mb,
        status: r.status || 'idle',
        progress: r.progress || 0
      };
    });

    return { success: true, data: recordings };
  } catch (error: any) {
    console.error('Erro ao consultar banco via Python:', error);
    return { success: false, error: error.message };
  }
}

export async function syncRecordings() {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const scriptPath = path.join(projectRoot, 'scripts', 'workflow_download.py');
    console.log('Attempting to sync recordings via:', scriptPath);
    const { stdout, stderr } = await execAsync(`python "${scriptPath}"`, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    if (stderr) {
      console.error('syncRecordings stderr:', stderr);
    }
    console.log('syncRecordings stdout:', stdout);
    return { success: true, message: 'Sincronização concluída!', details: stdout };
  } catch (error: any) {
    console.error('Erro na sincronização:', error);
    return { success: false, message: 'Falha na sincronização.', error: error.message };
  }
}

export async function processAction(actionType: 'download' | 'transcribe' | 'summarize', fileId: string) {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const scriptPath = path.join(projectRoot, 'scripts', 'process_single.py');
    const child = spawn('python', [scriptPath, actionType, fileId], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return { success: true, message: `Ação '${actionType}' iniciada em segundo plano.` };
  } catch (error: any) {
    console.error(`Erro na ação ${actionType} para o arquivo ${fileId}:`, error);
    return { success: false, message: `Falha na ação '${actionType}'.`, error: error.message };
  }
}

export async function pauseAction(fileId: string) {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const dbManagerPath = path.join(projectRoot, 'scripts', 'db_manager.py');
    const dbPath = path.join(projectRoot, 'data', 'plaud_records.db');

    // 1. Matar o processo python correspondente e seus processos filhos no Windows
    const killCmd = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'python.exe'\\" | Where-Object { $_.CommandLine -like '*${fileId}*' } | ForEach-Object { $pId = $_.ProcessId; Get-CimInstance Win32_Process -Filter \\"ParentProcessId = $pId\\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Stop-Process -Id $pId -Force }"`;
    
    console.log(`[pauseAction] Finalizando processos do arquivo: ${fileId}`);
    try {
      await execAsync(killCmd);
    } catch (e: any) {
      console.warn(`[pauseAction] Aviso/Erro ao tentar parar processos:`, e.message);
    }

    // 2. Atualizar o status do registro no banco SQLite para 'idle' com progresso 0
    if (fs.existsSync(dbPath)) {
      await new Promise<void>((resolve, reject) => {
        const payload = JSON.stringify({ id: fileId, status: 'idle', progress: 0 });
        const child = spawn('python', [dbManagerPath, 'update', payload], {
          env: { ...process.env, DATABASE_URL: dbPath, PYTHONIOENCODING: 'utf-8' }
        });
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`db_manager.py retornou código: ${code}`));
        });
        child.on('error', (err) => reject(err));
      });
    }

    return { success: true, message: 'Processamento pausado com sucesso.' };
  } catch (error: any) {
    console.error(`Erro ao pausar gravação ${fileId}:`, error);
    return { success: false, message: 'Erro ao pausar gravação.', error: error.message };
  }
}

export async function pauseAllActions() {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const dbPath = path.join(projectRoot, 'data', 'plaud_records.db');

    // 1. Matar qualquer processo python que esteja executando process_single.py, transcribe_local.py ou workflow_download.py no Windows
    const killCmd = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'python.exe'\\" | Where-Object { $_.CommandLine -like '*process_single.py*' -or $_.CommandLine -like '*transcribe_local.py*' -or $_.CommandLine -like '*workflow_download.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`;
    
    console.log(`[pauseAllActions] Interrompendo todas as tarefas ativas...`);
    try {
      await execAsync(killCmd);
    } catch (e: any) {
      console.warn(`[pauseAllActions] Aviso/Erro ao matar processos globais:`, e.message);
    }

    // 2. Resetar todas as gravações no banco SQLite que não estejam 'idle' ou 'error'
    if (fs.existsSync(dbPath)) {
      const pythonOneLiner = `import sqlite3; conn=sqlite3.connect(r'${dbPath}'); conn.cursor().execute("UPDATE recordings SET status='idle', progress=0 WHERE status NOT IN ('idle', 'error') AND status IS NOT NULL"); conn.commit(); conn.close()`;
      
      await new Promise<void>((resolve, reject) => {
        const child = spawn('python', ['-c', pythonOneLiner]);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Falha ao resetar status via SQLite: código ${code}`));
        });
        child.on('error', (err) => reject(err));
      });
    }

    return { success: true, message: 'Todas as tarefas ativas foram pausadas.' };
  } catch (error: any) {
    console.error('Erro ao pausar todas as tarefas:', error);
    return { success: false, message: 'Erro ao pausar todas as tarefas.', error: error.message };
  }
}

export async function updateObsidianPath(newPath: string) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('OBSIDIAN_PLAUD_PATH=')) {
        envContent = envContent.replace(/OBSIDIAN_PLAUD_PATH=.*/, `OBSIDIAN_PLAUD_PATH=${newPath}`);
      } else {
        envContent += `\nOBSIDIAN_PLAUD_PATH=${newPath}`;
      }
    } else {
      envContent = `OBSIDIAN_PLAUD_PATH=${newPath}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    process.env.OBSIDIAN_PLAUD_PATH = newPath;
    
    return { success: true, message: 'Caminho do Obsidian atualizado!' };
  } catch (error: any) {
    return { success: false, message: 'Erro ao atualizar caminho.', error: error.message };
  }
}
