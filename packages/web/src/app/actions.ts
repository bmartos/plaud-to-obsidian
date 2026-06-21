import { unstable_noStore } from 'next/cache';
import { installPlaudCli as serverInstallPlaudCli, loginPlaudCli as serverLoginPlaudCli, logoutPlaudCli as serverLogoutPlaudCli, getPlaudUser as serverGetPlaudUser, validatePlaudLogin as serverValidatePlaudLogin, listRecordings as serverListRecordings, syncRecordings as serverSyncRecordings, processAction as serverProcessAction, updateObsidianPath as serverUpdateObsidianPath, pauseAction as serverPauseAction, pauseAllActions as serverPauseAllActions, getFileContent as serverGetFileContent } from './server-api';


/**
 * Instala o CLI oficial globalmente se necessário.
 */
export async function installPlaudCli() {
  unstable_noStore();
  return serverInstallPlaudCli();
}

/**
 * Dispara o processo de login OAuth.
 */
export async function loginPlaudCli() {
  unstable_noStore();
  return serverLoginPlaudCli();
}

/**
 * Encerra a sessão no CLI oficial.
 */
export async function logoutPlaudCli() {
  unstable_noStore();
  return serverLogoutPlaudCli();
}

/**
 * Retorna as configurações atuais do ambiente.
 */
export async function getSettings() {
  unstable_noStore();

  return {
    obsidianPath: process.env.OBSIDIAN_PLAUD_PATH || 'Não configurado',
    region: process.env.PLAUD_REGION || 'eu',
  };
}

/**
 * Atualiza o caminho do Vault do Obsidian no arquivo .env local.
 */
export async function updateObsidianPath(newPath: string) {
  unstable_noStore();
  return serverUpdateObsidianPath(newPath);
}

/**
 * Valida silenciosamente se há uma sessão activa verificando o tokens.json oficial.
 */
export async function getPlaudUser() {
  unstable_noStore();
  return serverGetPlaudUser();
}

export async function validatePlaudLogin() {
  unstable_noStore();
  return serverValidatePlaudLogin();
}

/**
 * Lista as gravações usando o CLI oficial para evitar bloqueios de Cloudflare e erros de região.
 */
export async function listRecordings() {
  unstable_noStore();
  return serverListRecordings();
}

/**
 * Sincroniza as notas usando o script de pipeline local.
 */
export async function syncRecordings() {
  unstable_noStore();
  return serverSyncRecordings();
}

/**
 * Processa uma ação individual em um arquivo (download, transcribe, summarize)
 */
export async function processAction(actionType: 'download' | 'transcribe' | 'summarize', fileId: string) {
  unstable_noStore();
  return serverProcessAction(actionType, fileId);
}

export async function pauseAction(fileId: string) {
  unstable_noStore();
  return serverPauseAction(fileId);
}

export async function pauseAllActions() {
  unstable_noStore();
  return serverPauseAllActions();
}

export async function getFileContent(id: string, type: 'transcription' | 'summary') {
  unstable_noStore();
  return serverGetFileContent(id, type);
}

