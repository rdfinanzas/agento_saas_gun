/**
 * Seed para crear el super admin
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedSuperAdmin() {
  console.log('Creating Super Admin...\n');

  try {
    // Check if super admin tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { slug: 'agento-superadmin' },
    });

    if (!tenant) {
      // Create super admin tenant
      tenant = await prisma.tenant.create({
        data: {
          slug: 'agento-superadmin',
          name: 'AgenTo SuperAdmin',
          email: 'admin@agento.local',
          subscriptionTier: 'ENTERPRISE',
          quotaMaxRequests: 999999,
          quotaMaxStorage: BigInt(107374182400), // 100GB
        },
      });
      console.log('✓ Created super admin tenant');
    } else {
      console.log('✓ Super admin tenant already exists');
    }

    // Check if super admin user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@agento.local' },
    });

    if (existingUser) {
      console.log('✓ Super admin user already exists');
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash('agento123', 10);

      // Create super admin user
      const user = await prisma.user.create({
        data: {
          email: 'admin@agento.local',
          password: hashedPassword,
          name: 'Super Admin',
        },
      });
      console.log('✓ Created super admin user');

      // Link user to tenant as OWNER
      await prisma.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'OWNER',
        },
      });
      console.log('✓ Linked user to tenant as OWNER');
    }

    console.log('\n✅ Super Admin created successfully!');
    console.log('\nCredentials:');
    console.log('  Email: admin@agento.local');
    console.log('  Password: agento123');
    console.log('  Login: http://localhost:3001/admin-login');

  } catch (error: any) {
    console.error('❌ Error creating super admin:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

seedSuperAdmin();
