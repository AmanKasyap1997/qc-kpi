// src/seeders/mainSeeder.js
import { prisma } from '../../lib/prisma.js'

import { run as runPermissionSeeder } from '../seeder/permissionTableSeeder.js'
import { run as runRoleSeeder } from '../seeder/roleTableSeeder.js'
import { run as runTenantSeeder } from '../seeder/tenantTableSeeder.js'
import { run as runUserSeeder } from '../seeder/userSeeder.js'
import { run as runDepartmentSeeder } from '../seeder/department.js'

async function main() {
  console.log('Starting database seeding...\n')

  await runPermissionSeeder()
  await runRoleSeeder()
  await runTenantSeeder()
  await runDepartmentSeeder()
  await runUserSeeder()

  console.log('\nAll seeders completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Error during seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
