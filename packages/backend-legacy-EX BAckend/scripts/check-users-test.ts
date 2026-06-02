const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
    },
    take: 10,
  });

  console.log('=== Usuarios en el sistema ===');
  users.forEach(u => {
    console.log(`- ${u.email} (${u.name})`);
  });

  await prisma.$disconnect();
}

checkUsers().catch(console.error);
