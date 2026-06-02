const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkApiKeys() {
  const providers = await prisma.aIProvider.findMany();
  console.log('=== AI Providers en DB ===');
  providers.forEach(p => {
    console.log(`Provider: ${p.provider}`);
    console.log(`  displayName: ${p.displayName}`);
    console.log(`  apiKeyName: ${p.apiKeyName}`);
    console.log('---');
  });
  await prisma.$disconnect();
}

checkApiKeys().catch(console.error);
