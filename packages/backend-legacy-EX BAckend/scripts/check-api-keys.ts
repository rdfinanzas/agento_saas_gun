import { PrismaClient } from '@prisma/client';
import { SecureStorage } from '../src/modules/opencode/internal/classes/SecureStorage';

const secureStorage = new SecureStorage({
  storagePath: process.env.SECURE_STORAGE_PATH || './secure-storage',
  appId: 'agento-saas-global',
});

async function checkApiKeys() {
  const providers = [
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'kimi-coding', name: 'Kimi Coding' },
    { id: 'opencode', name: 'OpenCode' },
  ];

  console.log('=== API Keys Configuration ===\n');

  for (const provider of providers) {
    try {
      const credential = await secureStorage.getApiKey('global', provider.id as any);
      if (credential?.apiKey) {
        const maskedKey = credential.apiKey.substring(0, 10) + '...' + credential.apiKey.substring(credential.apiKey.length - 4);
        console.log(`✓ ${provider.name}: CONFIGURED`);
        console.log(`  Key: ${maskedKey}`);
        console.log(`  Base URL: ${credential.baseUrl || 'N/A'}`);
      } else {
        console.log(`✗ ${provider.name}: NOT CONFIGURED`);
      }
    } catch (err) {
      console.log(`✗ ${provider.name}: ERROR - ${err}`);
    }
    console.log('');
  }
}

checkApiKeys();
