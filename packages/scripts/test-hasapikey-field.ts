import { SecureStorage } from '../src/modules/opencode/internal/classes/SecureStorage';
import { PrismaClient } from '@prisma/client';

const secureStorage = new SecureStorage({
  storagePath: process.env.SECURE_STORAGE_PATH || './secure-storage',
  appId: 'agento-saas-global',
});

const prisma = new PrismaClient();

async function testHasApiKeyField() {
  console.log('=== Testing hasApiKey field in AI Providers ===\n');

  // Get all providers from database
  const providers = await prisma.aIProvider.findMany({
    include: {
      models: true,
    },
  });

  console.log(`Found ${providers.length} providers in database\n`);

  for (const provider of providers) {
    // Check if provider has API key
    const credential = await secureStorage.getApiKey('global', provider.provider as any);
    const hasApiKey = !!credential?.apiKey;

    console.log(`${provider.displayName} (${provider.provider}):`);
    console.log(`  - hasApiKey: ${hasApiKey ? '✓ true' : '✗ false'}`);
    console.log(`  - isActive: ${provider.isActive}`);
    console.log(`  - Models: ${provider.models.length}`);
    console.log('');
  }

  await prisma.$disconnect();
  process.exit(0);
}

testHasApiKeyField().catch(console.error);
