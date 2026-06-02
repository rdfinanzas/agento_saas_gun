import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function testEndpoint() {
  await prisma.$connect();

  // Get user
  const user = await prisma.user.findFirst({
    include: { tenants: { include: { tenant: true } } }
  });

  if (!user) {
    console.log('No users found');
    await prisma.$disconnect();
    return;
  }

  const tenantUser = user.tenants[0];

  // Create JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: tenantUser?.role || 'MEMBER',
    },
    process.env.JWT_SECRET || 'agento-secret-key',
    { expiresIn: '7d' }
  );

  console.log('Token (first 100 chars):', token.substring(0, 100) + '...');

  // Test the endpoint directly
  const providers = await prisma.aIProvider.findMany({
    where: { isActive: true },
    include: {
      models: {
        where: { isActive: true },
        orderBy: { displayName: 'asc' },
      },
    },
    orderBy: { displayName: 'asc' },
  });

  console.log('\n=== RESPONSE DATA ===');
  console.log('Providers:', providers.length);

  const response = {
    providers: providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      displayName: p.displayName,
      description: p.description,
      isActive: p.isActive,
      isDefault: p.isDefault,
      apiKeyName: p.apiKeyName,
      configSchema: p.configSchema,
      models: p.models.map((m) => ({
        id: m.id,
        modelId: m.modelId,
        displayName: m.displayName,
        description: m.description,
        isActive: m.isActive,
        maxTokens: m.maxTokens,
        supportsVision: m.supportsVision,
        supportsTools: m.supportsTools,
        supportsStreaming: m.supportsStreaming,
        costPer1kTokens: m.costPer1kTokens,
      })),
    })),
  };

  console.log('\nResponse sample:', JSON.stringify(response.providers.slice(0, 2), null, 2));

  await prisma.$disconnect();
}

testEndpoint();
