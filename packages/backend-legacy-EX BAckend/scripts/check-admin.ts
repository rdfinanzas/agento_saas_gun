import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function checkAdmin() {
  await prisma.$connect();
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@agento.local' }
  });

  if (admin) {
    console.log('Admin user found');
    console.log('Email:', admin.email);
    console.log('Name:', admin.name);

    // Test password
    const passwords = ['agento123', 'admin123', 'password', 'Admin123!'];
    for (const pwd of passwords) {
      const match = await bcrypt.compare(pwd, admin.password);
      console.log(`Password "${pwd}": ${match ? '✓ MATCH' : '✗ no match'}`);
    }
  } else {
    console.log('Admin user NOT found');
  }

  await prisma.$disconnect();
}

checkAdmin();
