// src/seeder/tenantTableSeeder.js
import { prisma } from '../../lib/prisma.js'

export async function run() {
  console.log('Seeding default tenant...')

  let tenant = await prisma.tenant.findFirst({
    where: { name: 'Default Tenant' }
  })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Default Tenant' }
    })
    console.log('Created tenant:', tenant.name)
  } else {
    console.log('Tenant already exists:', tenant.name)
  }

  console.log('Tenant seeding completed.')
}
