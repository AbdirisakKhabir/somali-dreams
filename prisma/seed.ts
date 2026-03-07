import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const DEFAULT_PERMISSIONS = [
  { name: "users.view", description: "View users", module: "users" },
  { name: "users.create", description: "Create users", module: "users" },
  { name: "users.edit", description: "Edit users", module: "users" },
  { name: "users.delete", description: "Delete users", module: "users" },
  { name: "roles.view", description: "View roles", module: "roles" },
  { name: "roles.create", description: "Create roles", module: "roles" },
  { name: "roles.edit", description: "Edit roles", module: "roles" },
  { name: "roles.delete", description: "Delete roles", module: "roles" },
  { name: "permissions.view", description: "View permissions", module: "permissions" },
  { name: "dashboard.view", description: "View dashboard", module: "dashboard" },
  { name: "members.view", description: "View members", module: "members" },
  { name: "members.create", description: "Create members", module: "members" },
  { name: "members.edit", description: "Edit members", module: "members" },
  { name: "members.delete", description: "Delete members", module: "members" },
  { name: "reports.view", description: "View reports", module: "reports" },
];

async function main() {
  for (const p of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: p.name },
      create: p,
      update: {},
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    create: {
      name: "Admin",
      description: "Full system access",
    },
    update: {},
  });

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
      update: {},
    });
  }

  const hashed = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@somalidreams.com" },
    create: {
      email: "admin@somalidreams.com",
      password: hashed,
      name: "Somali Dreams Admin",
      roleId: adminRole.id,
    },
    update: {},
  });

  console.log("Seed completed. Admin: admin@somalidreams.com / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
