/**
 * Script para crear un Super Admin completo con tenant
 * Uso: npx ts-node scripts/setup-super-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function setupSuperAdmin() {
  const email = 'admin@agento.local';
  const password = 'Admin123!';
  const name = 'Super Admin';
  const tenantSlug = 'agento-superadmin';
  const tenantName = 'AgenTo SuperAdmin';

  console.log('Setting up Super Admin...');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

  try {
    // Check if tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      // Create tenant for super admin
      tenant = await prisma.tenant.create({
        data: {
          slug: tenantSlug,
          name: tenantName,
          subscriptionTier: 'ENTERPRISE',
          quotaMaxRequests: 999999,
          quotaMaxStorage: BigInt(107374182400), // 100GB
        },
      });
      console.log(`Created tenant: ${tenantSlug}`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      console.log('User already exists. Updating password...');
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
    } else {
      // Create user
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
      });
      console.log('Created user');
    }

    // Create TenantUser relation with OWNER role
    const existingRelation = await prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
    });

    if (!existingRelation) {
      await prisma.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'OWNER',
        },
      });
      console.log('Created tenant-user relation with OWNER role');
    } else {
      await prisma.tenantUser.update({
        where: { id: existingRelation.id },
        data: { role: 'OWNER' },
      });
      console.log('Updated tenant-user relation to OWNER role');
    }

    console.log('\n✅ Super Admin setup complete!');
    console.log('\nLogin credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Tenant: ${tenantSlug}`);
    console.log('\nAccess the admin panel at: http://localhost:3001/admin');
    console.log('\nOr login at: http://localhost:3001/login');

  } catch (error: any) {
    console.error('Error setting up super admin:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

setupSuperAdmin();
