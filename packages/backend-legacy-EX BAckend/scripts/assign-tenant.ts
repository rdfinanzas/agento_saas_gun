const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignTenant() {
  // Buscar el usuario admin
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@agento.local' }
  });

  if (!admin) {
    console.log('Usuario admin no encontrado');
    return;
  }

  // Buscar el tenant test-tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'test-tenant' }
  });

  if (!tenant) {
    console.log('Tenant test-tenant no encontrado');
    return;
  }

  // Crear relación UserTenant
  const existing = await prisma.userTenant.findFirst({
    where: {
      userId: admin.id,
      tenantId: tenant.id
    }
  });

  if (existing) {
    console.log('El usuario ya tiene asignado este tenant');
    return;
  }

  await prisma.userTenant.create({
    data: {
      userId: admin.id,
      tenantId: tenant.id,
      role: 'ADMIN'
    }
  });

  console.log('✅ Tenant test-tenant asignado al usuario admin');
  console.log(`   User ID: ${admin.id}`);
  console.log(`   Tenant ID: ${tenant.id}`);
}

assign().catch(console.error).finally(() => prisma.$disconnect());
