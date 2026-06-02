import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDeepSeek() {
  await prisma.$connect();

  const deepseek = await prisma.aIProvider.findUnique({
    where: { provider: 'deepseek' },
    include: { models: true }
  });

  if (deepseek) {
    console.log('DeepSeek found:', deepseek.displayName);
    console.log('API Key:', deepseek.apiKeyName);
    console.log('Active:', deepseek.isActive);
    console.log('Models:', deepseek.models.length);
    deepseek.models.forEach(m => console.log('  -', m.modelId, m.displayName));
  } else {
    console.log('DeepSeek not found');
  }

  await prisma.$disconnect();
}

checkDeepSeek();
