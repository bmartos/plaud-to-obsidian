const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8199;
const CLIENT_ID = 'client_f9e0b214-c11f-434b-8b95-c4497d1feb81';
const REDIRECT_URI = 'http://localhost:8199/auth/callback';
const TOKEN_URL = 'https://platform.plaud.ai/developer/api/oauth/third-party/access-token';
const USER_INFO_URL = 'https://platform.plaud.ai/developer/api/open/third-party/users/current';

// A porta/origem onde a aplicação web está rodando (passada como argumento pelo Next.js)
const originUrl = process.argv[2] || 'http://localhost:3000';

// Generate PKCE code verifier and challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
const state = crypto.randomBytes(16).toString('base64url');

// Build authorization URL
const params = new URLSearchParams({
  client_id: CLIENT_ID,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
  state: state,
  scope: 'profile,files-200,file-sources,file-notes,file-audio'
});

const authUrl = `https://web.plaud.ai/platform/oauth?${params.toString()}`;

console.log('\n=============================================================');
console.log('                   PLAUD LOGIN HELPER                        ');
console.log('=============================================================');
console.log('\n1. Abra o link abaixo no seu navegador para fazer o login:\n');
console.log(`   \x1b[36m${authUrl}\x1b[0m\n`);
console.log('2. O processo sistêmico está aguardando a resposta de autenticação...');

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  
  if (reqUrl.pathname !== '/auth/callback') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const code = reqUrl.searchParams.get('code');
  const receivedState = reqUrl.searchParams.get('state');

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Erro na autenticação: Código de autorização não recebido.</h1>');
    return;
  }

  if (receivedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Erro na autenticação: State inválido (possível ataque CSRF).</h1>');
    return;
  }

  try {
    console.log('\n[+] Código recebido. Trocando código pelo token de acesso...');
    
    // Exchange Authorization Code for Access Token
    const basicAuth = Buffer.from(`${CLIENT_ID}:`).toString('base64');
    const tokenRequestBody = new URLSearchParams({
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
      state: state
    });

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: tokenRequestBody.toString()
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Erro na troca de token API: ${tokenResponse.status} ${tokenResponse.statusText} - ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token || tokenData.accessToken;
    const tokenType = tokenData.token_type || tokenData.tokenType || 'Bearer';
    const expiresIn = tokenData.expires_in || 3600;

    console.log('[+] Token obtido com sucesso! Buscando perfil do usuário...');

    // Fetch User Profile to get their real email
    const userResponse = await fetch(USER_INFO_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let email = 'Usuário Plaud';
    let nickname = 'Usuário';
    if (userResponse.ok) {
      const userData = await userResponse.json();
      const user = userData.data || userData;
      email = user.email || email;
      nickname = user.nickname || nickname;
      console.log(`[+] Identificado: ${nickname} (${email})`);
    }

    // Prepare credentials config object
    const finalConfig = {
      credentials: {
        email: email,
        password: 'x',
        region: 'us'
      },
      token: {
        accessToken: accessToken,
        tokenType: tokenType,
        issuedAt: Date.now(),
        expiresAt: Date.now() + expiresIn * 1000
      }
    };

    // Save to ~/.plaud/config.json
    const plaudDir = path.join(os.homedir(), '.plaud');
    if (!fs.existsSync(plaudDir)) {
      fs.mkdirSync(plaudDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(plaudDir, 'config.json'),
      JSON.stringify(finalConfig, null, 2),
      'utf-8'
    );

    // Save to ~/.plaud/tokens.json as well for global CLI compatibility
    const tokensConfig = {
      access_token: accessToken,
      token_type: tokenType,
      expires_at: Date.now() + expiresIn * 1000
    };
    fs.writeFileSync(
      path.join(plaudDir, 'tokens.json'),
      JSON.stringify(tokensConfig, null, 2),
      'utf-8'
    );

    console.log(`\n\x1b[32m[SUCESSO] Login concluído! Sessões salvas em config.json e tokens.json\x1b[0m`);
    
    // Respond to user browser
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head>
          <style>
            body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f0fdf4; }
            .card { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid #bbf7d0; }
            h1 { color: #166534; margin-bottom: 8px; }
            p { color: #15803d; }
            .timer { font-weight: bold; color: #166534; }
          </style>
          <script>
            let count = 3;
            const interval = setInterval(() => {
              count--;
              document.getElementById('seconds').innerText = count;
              if (count <= 0) {
                clearInterval(interval);
                window.close();
                // Fallback caso o navegador bloqueie window.close()
                setTimeout(() => {
                  window.location.href = '${originUrl}';
                }, 500);
              }
            }, 1000);
          </script>
        </head>
        <body>
          <div class="card">
            <h1>Login Concluído com Sucesso!</h1>
            <p>Esta aba será fechada automaticamente em <span id="seconds" class="timer">3</span> segundos...</p>
          </div>
        </body>
      </html>
    `);

    // Shutdown helper system process cleanly after response is sent
    setTimeout(() => {
      server.close(() => {
        console.log('[+] Processo sistêmico finalizado.');
        process.exit(0);
      });
    }, 4000);

  } catch (error) {
    console.error(`\n\x1b[31m[ERRO] Falha ao processar login: ${error.message}\x1b[0m`);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>Erro no processamento da autenticação</h1><pre>${error.message}</pre>`);
  }
});

server.listen(PORT, () => {
  // Let the user know the server is ready
});
