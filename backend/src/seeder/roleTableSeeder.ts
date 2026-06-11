// src/seeder/roleTableSeeder.js
import { prisma } from '../../lib/prisma.js'

export const RoleEnum = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  EXECUTIVE: 'executive',
  FLOORMANAGER: 'floormanager',
  AGENT: 'agnet',
}

export async function run() {
  console.log('Seeding roles...')

  const allPermissions = await prisma.permission.findMany()
  if (allPermissions.length === 0) {
    throw new Error('No permissions found — run permission seeder first')
  }

  const permissionIds = allPermissions.map(p => p.id)

  // SUPER ADMIN
  const superAdmin = await prisma.role.upsert({
    where: { name: RoleEnum.SUPER_ADMIN },
    update: {},
    create: { name: RoleEnum.SUPER_ADMIN }
  })

  await syncPermissions(superAdmin.id, permissionIds)

  // ADMIN
  const admin = await prisma.role.upsert({
    where: { name: RoleEnum.ADMIN },
    update: {},
    create: { name: RoleEnum.ADMIN }
  })

  const adminPermissionIds = await getAdminPermissions()
  await syncPermissions(admin.id, adminPermissionIds)

  // OPERATOR
  const operator = await prisma.role.upsert({
    where: { name: RoleEnum.OPERATOR },
    update: {},
    create: { name: RoleEnum.OPERATOR }
  })

  const operatorPermissionIds = await getOperatorPermissions()
  await syncPermissions(operator.id, operatorPermissionIds)

  console.log('Roles seeded successfully!')
}

async function syncPermissions(roleId:any, permissionIds:any) {
  await prisma.roleHasPermission.deleteMany({ where: { roleId } })

  for (const permissionId of permissionIds) {
    await prisma.roleHasPermission.create({
      data: { roleId, permissionId }
    })
  }
}

async function getAdminPermissions() {
  const permissions = await prisma.permission.findMany({
    where: {
      name: {
        in: [
          'user-list', 'user-create', 'user-edit', 'user-delete',
          'tenant-list', 'tenant-create', 'tenant-edit', 'tenant-delete',
          'role-list', 'role-create', 'role-edit', 'role-delete',
          'permission-list', 'permission-create', 'permission-edit', 'permission-delete',
          'report-list', 'report-export',
          'notification-list',
          'activity-list',
          'view-call','flag-call'
        ]
      }
    }
  })
  return permissions.map(p => p.id)
}

async function getOperatorPermissions() {
  const permissions = await prisma.permission.findMany({
    where: {
      name: {
        in: [
          'tenant-view', 'role-view', 'permission-view', 'user-view',
          'report-view', 'notification-view', 'activity-view',
          'view-import', 'view-leads', 'view-dnc',
          'view-call'
        ]
      }
    }
  })
  return permissions.map(p => p.id)
}
