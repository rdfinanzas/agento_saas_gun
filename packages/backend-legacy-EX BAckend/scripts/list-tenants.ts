const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.tenant.findMany().then(tenants => {
  console.log('Tenants encontrados:');
  tenants.forEach(t => {
    console.log(`- ID: ${t.id}, Slug: ${t.slug}, Name: ${t.name}`);
  });
}).finally(() => prisma.$disconnect());
