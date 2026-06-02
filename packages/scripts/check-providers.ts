import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProviders() {
  await prisma.$connect();
  const providers = await prisma.aIProvider.findMany({
    where: { isActive: true },
    include: { models: { where: { isActive: true }}}
  });
  console.log('Providers:', providers.length);
  providers.forEach(p => {
    console.log(`- ${p.displayName}: ${p.models.length} models`);
  });
  await prisma.$disconnect();
}

checkProviders();
