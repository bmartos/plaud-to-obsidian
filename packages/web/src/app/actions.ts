'use server';

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Path absoluto para evitar problemas de resolução no Windows
const OFFICIAL_PLAUD_PATH = 'C:\\Users\\bmart\\AppData\\Roaming\\npm\\plaud.cmd';
const DB_PATH = process.env.DATABASE_URL?.replace('sqlite://', '') || './data/plaud_records.db';

/**
 * Instala o CLI oficial globalmente se necessário.
 */
export async function installPlaudCli() {
  try {
    const { stdout, stderr } = await execAsync('npm install -g @plaud-ai/cli');
    return { success: true, message: 'CLI instalado com sucesso!', details: stdout || stderr };
  } catch (error: any) {
    return { success: false, message: 'Falha ao instalar o CLI.', error: error.message };
  }
}

/**
 * Dispara o processo de login OAuth.
 */
export async function loginPlaudCli() {
  try {
    return await new Promise((resolve) => {
      const child = spawn(`"${OFFICIAL_PLAUD_PATH}"`, ['login'], { shell: 'cmd.exe', env: process.env });
      let capturedUrl = '';
      child.stdout.on('data', (data) => {
        const output = data.toString();
        const urlMatch = output.match(/https?:\/\/[^\s]+/);
        if (urlMatch && !capturedUrl) {
          capturedUrl = urlMatch[0];
          resolve({ success: true, message: 'URL de autenticação gerada.', url: capturedUrl });
        }
      });
      setTimeout(() => { if (!capturedUrl) resolve({ success: true, message: 'Comando enviado. Verifique seu navegador.' }); }, 10000);
      child.on('error', (err) => resolve({ success: false, message: 'Erro ao disparar login.', error: err.message }));
    });
  } catch (error: any) {
    return { success: false, message: 'Erro ao disparar login.', error: error.message };
  }
}

/**
 * Encerra a sessão no CLI oficial.
 */
export async function logoutPlaudCli() {
  try {
    const { stdout } = await execAsync(`"${OFFICIAL_PLAUD_PATH}" logout`);
    return { success: true, message: 'Logout realizado com sucesso!', details: stdout };
  } catch (error: any) {
    return { success: false, message: 'Falha ao realizar logout.', error: error.message };
  }
}

/**
 * Retorna as configurações atuais do ambiente.
 */
export async function getSettings() {
  return {
    obsidianPath: process.env.OBSIDIAN_PLAUD_PATH || 'Não configurado',
    region: process.env.PLAUD_REGION || 'eu',
    dbPath: DB_PATH
  };
}

/**
 * Atualiza o caminho do Vault do Obsidian no arquivo .env local.
 */
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

/**
 * Valida silenciosamente se há uma sessão ativa verificando o tokens.json oficial.
 */
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
    const tokensPath = path.join(os.homedir(), '.plaud', 'tokens.json');
    if (fs.existsSync(tokensPath)) {
      const raw = fs.readFileSync(tokensPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.access_token || data.accessToken) {
        return { success: true, data: { email: data.email || 'Usuário Plaud' } };
      }
    }
    return { success: false };
  } catch (e) {
    return { success: false };
  }
}

/**
 * Lista as gravações usando o CLI oficial para evitar bloqueios de Cloudflare e erros de região.
 */
export async function listRecordings() {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const scriptPath = path.join(projectRoot, 'scripts', 'db_manager.py');
    const dbPath = path.join(projectRoot, 'data', 'plaud_records.db');
    
    if (!fs.existsSync(dbPath)) {
      return { success: true, data: [] };
    }

    // Usar o db_manager.py em Python, pois ele já retorna JSON estruturado 
    // e o CLI do sqlite3 não está disponível globalmente no ambiente.
    const { stdout } = await execAsync(`python "${scriptPath}" list`, {
      env: { ...process.env, DATABASE_URL: dbPath, PYTHONIOENCODING: 'utf-8' }
    });
    
    if (!stdout.trim()) {
       return { success: true, data: [] };
    }

    const rawRecords = JSON.parse(stdout);
    
    const recordings = rawRecords.map((r: any) => {
      // Logic for is_synced: Consider synced if it's been downloaded
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
        filesize_mb: r.filesize_mb
      };
    });

    return { success: true, data: recordings };
  } catch (error: any) {
    console.error('Erro ao consultar banco via Python:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sincroniza as notas usando o script de pipeline local.
 */
export async function syncRecordings() {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const scriptPath = path.join(projectRoot, 'scripts', 'workflow_download.py');

    // Executa o novo workflow em Python
    const { stdout } = await execAsync(`python "${scriptPath}"`, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    return { success: true, message: 'Sincronização concluída!', details: stdout };
  } catch (error: any) {
    console.error('Erro na sincronização:', error);
    return { success: false, message: 'Falha na sincronização.', error: error.message };
  }
}

/**
 * Processa uma ação individual em um arquivo (download, transcribe, summarize)
 */
export async function processAction(actionType: 'download' | 'transcribe' | 'summarize', fileId: string) {
  try {
    const projectRoot = path.resolve(process.cwd(), '../..');
    const scriptPath = path.join(projectRoot, 'scripts', 'process_single.py');

    const { stdout, stderr } = await execAsync(`python "${scriptPath}" ${actionType} ${fileId}`, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    return { success: true, message: `Ação '${actionType}' concluída com sucesso!`, details: stdout };
  } catch (error: any) {
    console.error(`Erro na ação ${actionType} para o arquivo ${fileId}:`, error);
    return { success: false, message: `Falha na ação '${actionType}'.`, error: error.message };
  }
}
