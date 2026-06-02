const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function resetPassword() {
  const password = await bcrypt.hash('admin123', 10);

  await prisma.user.update({
    where: { email: 'admin@agento.local' },
    data: { password }
  });

  console.log('Contraseña de admin@agento.local reseteada a: admin123');
  await prisma.$disconnect();
}

resetPassword().catch(console.error);
