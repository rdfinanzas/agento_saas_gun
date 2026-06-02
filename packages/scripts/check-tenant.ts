import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTenant() {
  await prisma.$connect();
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'rdfinanzas' } });
  console.log('Tenant:', tenant ? 'EXISTS' : 'NOT FOUND');
  if (tenant) {
    console.log('Name:', tenant.name);
    console.log('Subscription:', tenant.subscriptionTier);
  }
  await prisma.$disconnect();
}

checkTenant();
