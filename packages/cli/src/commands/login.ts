import { PlaudConfig, PlaudAuth, PlaudClient } from '@plaud/core';
import { execSync } from 'child_process';

export async function loginCommand(_args: string[]): Promise<void> {
  console.log('\n--- Plaud Authentication Setup ---');
  
  const config = new PlaudConfig();
  let token = config.getToken();

  if (token) {
    console.log('Checking for existing session...');
    try {
      const auth = new PlaudAuth(config);
      const client = new PlaudClient(auth, 'eu');
      const user = await client.getUserInfo();
      
      console.log(`\n✅ Active session detected!`);
      console.log(`User: ${user.nickname} (${user.email})`);
      console.log('If you want to switch accounts, please run `plaud login` manually in your terminal.');
      return;
    } catch (err) {
      console.log('Existing session is invalid or expired. Starting new login...');
    }
  }

  console.log('\nNo active session found. We will now trigger the official Plaud CLI login.');
  console.log('Requirement: You must have `@plaud-ai/cli` installed (`npm install -g @plaud-ai/cli`).');
  
  try {
    console.log('\nExecuting: plaud login');
    console.log('------------------------------------------------------------');
    // Use inherit to allow the child process to handle the browser open and user interaction
    execSync('plaud login', { stdio: 'inherit' });
    console.log('------------------------------------------------------------');
    
    // Check again after login
    const updatedToken = config.getToken();
    if (updatedToken) {
      const auth = new PlaudAuth(config);
      const client = new PlaudClient(auth, 'eu');
      const user = await client.getUserInfo();
      console.log(`\n✅ Login successful!`);
      console.log(`User: ${user.nickname} (${user.email})`);
    } else {
      console.log('\n❌ Login appeared to finish, but no session token was found.');
    }
  } catch (err: any) {
    console.error(`\n❌ Error executing official login: \${err.message}`);
    console.log('Please make sure @plaud-ai/cli is installed globally: npm install -g @plaud-ai/cli');
  }
}
