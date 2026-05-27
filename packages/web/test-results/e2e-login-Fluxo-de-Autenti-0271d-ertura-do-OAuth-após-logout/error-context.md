# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\login.spec.ts >> Fluxo de Autenticação Plaud >> deve iniciar o processo de login e detectar a abertura do OAuth após logout
- Location: e2e\login.spec.ts:23:7

# Error details

```
Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - heading "PlaudToObsidian" [level=1] [ref=e6]
        - paragraph [ref=e7]: Automatize seu fluxo de notas com IA.
      - generic [ref=e8]:
        - generic [ref=e9]:
          - img [ref=e11]
          - generic [ref=e13]:
            - heading "Começar Integração" [level=2] [ref=e14]
            - paragraph [ref=e15]: Faça login com sua conta Plaud AI para começar a sincronizar.
        - generic [ref=e16]:
          - button "Instalar CLI" [disabled] [ref=e17]:
            - img [ref=e19]
            - generic [ref=e21]: Instalar CLI
          - button "Fazer Login" [disabled] [ref=e22]:
            - img [ref=e24]
            - generic [ref=e26]: Fazer Login
          - button "Validar Login" [disabled] [ref=e27]:
            - img [ref=e29]
            - generic [ref=e31]: Validar Login
      - generic [ref=e33]:
        - paragraph [ref=e34]: O comando "plaud me" falhou.
        - generic [ref=e35]: "Command failed: \"C:\\Users\\bmart\\AppData\\Roaming\\npm\\plaud.cmd\" me - Fetching user info... ✗ [AUTH_FAILED] Token invalid or expired. Run `plaud login`."
      - link "Documentação Oficial" [ref=e37] [cursor=pointer]:
        - /url: https://docs.plaud.ai
  - button "Open Next.js Dev Tools" [ref=e43] [cursor=pointer]:
    - img [ref=e44]
  - alert [ref=e47]
```