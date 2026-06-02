import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function testWithToken() {
  await prisma.$connect();

  // Get user rdfinanzas
  const user = await prisma.user.findFirst({
    where: { email: 'rdfinanzas@gmail.com' },
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

  // Create JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: tenantUser.role,
    },
    process.env.JWT_SECRET || 'agento-secret-key',
    { expiresIn: '7d' }
  );

  console.log('=== TOKEN FOR TESTING ===');
  console.log(token);
  console.log('\nAdd this to localStorage:');
  console.log(`localStorage.setItem('token', '${token}');`);

  await prisma.$disconnect();
}

testWithToken();
