const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function resetPassword() {
  const password = await bcrypt.hash('rd130581', 10);

  await prisma.user.update({
    where: { email: 'rdfinanzas@gmail.com' },
    data: { password }
  });

  console.log('Contraseña de rdfinanzas@gmail.com reseteada a: rd130581');
  await prisma.$disconnect();
}

resetPassword().catch(console.error);
