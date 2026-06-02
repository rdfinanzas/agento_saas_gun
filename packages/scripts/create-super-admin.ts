/**
 * Script para crear un usuario Super Admin
 * Uso: npx ts-node scripts/create-super-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSuperAdmin() {
  const email = 'admin@agento.local';
  const password = 'Admin123!';
  const name = 'Super Admin';

  console.log('Creating Super Admin user...');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('User already exists. Updating password...');

      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });

      console.log('Password updated successfully!');
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
      });

      console.log('Super Admin created successfully!');
      console.log(`User ID: ${user.id}`);
    }

    console.log('\nYou can now login with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\nAccess the admin panel at: http://localhost:3001/admin');

  } catch (error: any) {
    console.error('Error creating super admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
