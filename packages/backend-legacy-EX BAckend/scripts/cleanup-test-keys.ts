import { SecureStorage } from '../src/modules/opencode/internal/classes/SecureStorage';

const secureStorage = new SecureStorage({
  storagePath: process.env.SECURE_STORAGE_PATH || './secure-storage',
  appId: 'agento-saas-global',
});

async function cleanupTestKeys() {
  await secureStorage.deleteApiKey('global', 'deepseek');
  await secureStorage.deleteApiKey('global', 'opencode');
  console.log('✓ Test API keys removed');
}

cleanupTestKeys();
