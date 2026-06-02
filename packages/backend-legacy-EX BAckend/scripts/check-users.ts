import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  await prisma.$connect();

  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      tenants: {
        select: {
          tenant: {
            select: {
              slug: true,
              name: true,
            },
          },
          role: true,
        },
      },
    },
  });

  console.log('Users in database:');
  users.forEach(u => {
    console.log(`- ${u.email} (${u.name})`);
    u.tenants.forEach(t => {
      console.log(`  └─ ${t.tenant.slug} (${t.tenant.name}) - Role: ${t.role}`);
    });
  });

  await prisma.$disconnect();
}

checkUsers();
