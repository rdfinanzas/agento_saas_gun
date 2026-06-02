import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function testAIProviders() {
  await prisma.$connect();

  // Get admin user
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

  console.log('Token created:', token.substring(0, 50) + '...');

  // Test AI providers endpoint
  const providers = await prisma.aIProvider.findMany({
    where: { isActive: true },
    include: { models: { where: { isActive: true }}}
  });

  console.log('\nProviders from DB:', providers.length);
  providers.forEach(p => {
    console.log(`- ${p.displayName}: ${p.models.length} models`);
  });

  await prisma.$disconnect();
}

testAIProviders();
