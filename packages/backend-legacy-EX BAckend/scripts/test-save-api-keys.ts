import { SecureStorage } from '../src/modules/opencode/internal/classes/SecureStorage';

const secureStorage = new SecureStorage({
  storagePath: process.env.SECURE_STORAGE_PATH || './secure-storage',
  appId: 'agento-saas-global',
});

async function testSaveApiKeys() {
  console.log('Testing API Keys save...\n');

  // Test DeepSeek
  try {
    await secureStorage.storeApiKey(
      'global',
      'deepseek',
      'sk-test-deepseek-1234567890abcdef',
      'https://api.deepseek.com'
    );
    console.log('✓ DeepSeek API key saved');

    // Verify it was saved
    const credential = await secureStorage.getApiKey('global', 'deepseek');
    if (credential?.apiKey) {
      console.log('  Verified:', credential.apiKey);
    } else {
      console.log('  ✗ Failed to retrieve');
    }
  } catch (err) {
    console.log('✗ DeepSeek error:', err);
  }

  // Test OpenCode
  try {
    await secureStorage.storeApiKey(
      'global',
      'opencode',
      'sk-opencode-test123',
      'https://api.opencode.ai/v1'
    );
    console.log('✓ OpenCode API key saved');

    const credential = await secureStorage.getApiKey('global', 'opencode');
    if (credential?.apiKey) {
      console.log('  Verified:', credential.apiKey);
    } else {
      console.log('  ✗ Failed to retrieve');
    }
  } catch (err) {
    console.log('✗ OpenCode error:', err);
  }

  console.log('\nDone!');
}

testSaveApiKeys();
