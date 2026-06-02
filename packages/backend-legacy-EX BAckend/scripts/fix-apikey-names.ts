const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixApiKeyNames() {
  console.log('Corrigiendo apiKeyNames...');

  // Fix opencode
  await prisma.aIProvider.update({
    where: { provider: 'opencode' },
    data: { apiKeyName: 'OPENCODE_API_KEY' }
  });
  console.log('✓ opencode: apiKeyName corregido a OPENCODE_API_KEY');

  // Fix deepseek
  await prisma.aIProvider.update({
    where: { provider: 'deepseek' },
    data: { apiKeyName: 'DEEPSEEK_API_KEY' }
  });
  console.log('✓ deepseek: apiKeyName corregido a DEEPSEEK_API_KEY');

  // Fix bedrock (vacío)
  await prisma.aIProvider.update({
    where: { provider: 'bedrock' },
    data: { apiKeyName: 'AWS_ACCESS_KEY_ID' }
  });
  console.log('✓ bedrock: apiKeyName corregido a AWS_ACCESS_KEY_ID');

  // Fix vertex (vacío)
  await prisma.aIProvider.update({
    where: { provider: 'vertex' },
    data: { apiKeyName: 'GOOGLE_VERTEX_CREDENTIALS' }
  });
  console.log('✓ vertex: apiKeyName corregido a GOOGLE_VERTEX_CREDENTIALS');

  console.log('\n=== Verificación ===');
  const providers = await prisma.aIProvider.findMany();
  providers.forEach(p => {
    console.log(`${p.provider}: ${p.apiKeyName}`);
  });

  await prisma.$disconnect();
  console.log('\n✓ Datos corregidos correctamente');
}

fixApiKeyNames().catch(console.error);
