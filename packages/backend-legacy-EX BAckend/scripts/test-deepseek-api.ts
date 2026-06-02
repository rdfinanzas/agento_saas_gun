import { SecureStorage } from '../src/modules/opencode/internal/classes/SecureStorage';

const secureStorage = new SecureStorage({
  storagePath: process.env.SECURE_STORAGE_PATH || './secure-storage',
  appId: 'agento-saas-global',
});

async function testDeepSeekAPI() {
  console.log('=== Testing DeepSeek API ===\n');

  // Get the stored API key
  const credential = await secureStorage.getApiKey('global', 'deepseek');

  if (!credential?.apiKey) {
    console.log('✗ No API key found for DeepSeek');
    process.exit(1);
  }

  console.log('✓ API Key found');
  console.log('  Base URL:', credential.baseUrl);
  console.log('  Key:', credential.apiKey.substring(0, 10) + '...' + credential.apiKey.substring(credential.apiKey.length - 4));
  console.log('');

  // Test API call
  console.log('Making test API call to DeepSeek...');

  try {
    const response = await fetch(credential.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credential.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: 'Say "Hello from DeepSeek!" in exactly that way.' }
        ],
        max_tokens: 50,
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('✗ API Error:', errorText);
      process.exit(1);
    }

    const data: any = await response.json();
    console.log('\n✓ API call successful!');
    console.log('\nResponse:');
    console.log(data.choices[0].message.content);

    console.log('\n=== Test passed! DeepSeek API is working correctly ===');
  } catch (error: any) {
    console.log('\n✗ Request failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

testDeepSeekAPI().catch(console.error);
