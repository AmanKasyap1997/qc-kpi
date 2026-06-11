// src/seeder/userSeeder.js
import { prisma } from '../../lib/prisma.js'
import bcrypt from 'bcryptjs'

export async function run() {
  console.log('Seeding users (Admin + Super Admin)...')

  // ----------------------------------------
  // Get Default Tenant
  // ----------------------------------------
  const tenant = await prisma.tenant.findFirst({
    where: { name: 'Default Tenant' }
  })

  if (!tenant) throw new Error('❌ Default Tenant is missing. Run tenant seeder first.')

  // ----------------------------------------
  // Get admin + super-admin roles
  // ----------------------------------------
  const adminRole = await prisma.role.findUnique({
    where: { name: 'admin' }
  })

  if (!adminRole) throw new Error('❌ Admin role missing. Run role seeder first.')

  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'super_admin' }
  })

  if (!superAdminRole) throw new Error('❌ Super Admin role missing. Add to role seeder.')


  // ----------------------------------------
  // Create SUPER ADMIN
  // ----------------------------------------
  const superAdminEmail = 'superadmin@example.com'
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail }
  })

  if (!existingSuperAdmin) {
    const hashed = await bcrypt.hash('superadmin123', 10)

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        departmentId:1,
        roleId: superAdminRole.id,
        name: 'Super Admin User',
        email: superAdminEmail,
        password: hashed
      }
    })

    console.log(`✅ Super Admin created: ${superAdmin.email}`)
  } else {
    console.log('ℹ️ Super Admin already exists')
  }


  // ----------------------------------------
  // Create ADMIN
  // ----------------------------------------
  const adminEmail = 'admin@example.com'
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  })

  if (!existingAdmin) {
    const hashed = await bcrypt.hash('admin123', 10)

    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        departmentId:1,
        roleId: adminRole.id,
        name: 'Admin User',
        email: adminEmail,
        password: hashed
      }
    })

    console.log(`✅ Admin created: ${admin.email}`)
  } else {
    console.log('ℹ️ Admin already exists')
  }

  console.log('✅ User seeding completed.')
}
