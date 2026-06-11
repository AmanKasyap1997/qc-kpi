// src/seeder/permissionTableSeeder.js
import { prisma } from '../../lib/prisma.js'

export async function run() {
  console.log('Seeding permissions...')

  const permissions = [
    'tenant-view', 'tenant-list', 'tenant-create', 'tenant-edit', 'tenant-delete',
    'role-view', 'role-list', 'role-create', 'role-edit', 'role-delete',
    'permission-view', 'permission-list', 'permission-create', 'permission-edit', 'permission-delete',
    'user-view', 'user-list', 'user-create', 'user-edit', 'user-delete',
    'report-view', 'report-list', 'report-export',
    'notification-view', 'notification-list',
    'activity-view', 'activity-list',
    'view-call','flag-call'
  ]

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Permission for ${name.replace(/-/g, ' ')}`,
      },
    })
  }

  console.log('Permissions seeded successfully!')
}
