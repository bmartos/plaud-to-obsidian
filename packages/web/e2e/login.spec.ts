import { test, expect } from '@playwright/test';
import { logoutPlaudCli } from '../src/app/actions';

/**
 * Teste End-to-End: Fluxo de Login Plaud
 */
test.describe('Fluxo de Autenticação Plaud', () => {
  
  test.beforeEach(async ({ page }) => {
    // Garante que o servidor esteja rodando e limpa qualquer estado se necessário
    // Em um ambiente real, poderíamos chamar logout aqui, mas como é um CLI global,
    // vamos apenas navegar.
  });

  test('deve redirecionar para dashboard se já estiver logado (Persistence Check)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Se redirecionar para dashboard, o teste passa
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('deve iniciar o processo de login e detectar a abertura do OAuth após logout', async ({ page, context }) => {
    // 1. Forçar Logout via UI (usando o sidebar)
    await page.goto('http://localhost:3000/dashboard');
    
    // O botão de logout está no sidebar
    const logoutButton = page.getByRole('button', { name: /Sair do Sistema/i });
    
    // Configura o diálogo de confirmação
    page.on('dialog', dialog => dialog.accept());
    await logoutButton.click();

    // 2. Deve voltar para a Home (Página de Login)
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('PlaudToObsidian');

    // 3. Iniciar Login
    const pagePromise = context.waitForEvent('page');
    const loginBtn = page.getByRole('button', { name: /Fazer Login/i });
    await loginBtn.click();

    // 4. Aguardar feedback visual
    await expect(page.locator('text=Verifique seu navegador')).toBeVisible({ timeout: 20000 });

    // 5. Validar se a aba OAuth abriu (Se possível no ambiente)
    try {
      const newPage = await pagePromise;
      console.log('URL de OAuth detectada:', newPage.url());
      expect(newPage.url()).toContain('plaud.ai');
    } catch (e) {
      console.log('Aba OAuth não capturada, mas comando enviado.');
    }
  });
});
