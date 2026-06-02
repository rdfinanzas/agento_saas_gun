import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function testLogin() {
  await prisma.$connect();

  const user = await prisma.user.findUnique({
    where: { email: 'admin@agento.local' },
    include: { tenants: { include: { tenant: true } } }
  });

  if (!user) {
    console.log('User not found');
    await prisma.$disconnect();
    return;
  }

  const tenantUser = user.tenants[0];
  if (!tenantUser) {
    console.log('No tenant found');
    await prisma.$disconnect();
    return;
  }

  // Test passwords
  const passwords = ['Admin123!', 'agento123'];
  for (const pwd of passwords) {
    const match = await bcrypt.compare(pwd, user.password);
    console.log(`Password "${pwd}": ${match ? 'MATCH' : 'NO MATCH'}`);
  }

  await prisma.$disconnect();
}

testLogin();
