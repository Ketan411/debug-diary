import { PrismaClient } from "@prisma/client";

async function testConnection(url: string) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    await p.$connect();
    console.log(`✅ Success connecting to: ${url.replace(/:[^:@]+@/, ":***@")}`);
    const users = await p.user.count();
    console.log(`   User count: ${users}`);
    await p.$disconnect();
    return true;
  } catch (err) {
    console.log(`❌ Failed connecting to: ${url.replace(/:[^:@]+@/, ":***@")}`);
    console.log(`   Error: ${(err as Error).message}`);
    await p.$disconnect();
    return false;
  }
}

async function main() {
  const urls = [
    process.env.DATABASE_URL || "postgresql://debugdiary:debugdiary@localhost:5433/debugdiary",
    "postgresql://debugdiary:debugdiary@localhost:5432/debugdiary",
    "postgresql://postgres:postgres@localhost:5432/debugdiary",
    "postgresql://postgres:postgres@localhost:5432/postgres",
    "postgresql://postgres:admin@localhost:5432/postgres",
    "postgresql://postgres:root@localhost:5432/postgres",
  ];

  for (const url of urls) {
    const ok = await testConnection(url);
    if (ok) break;
  }
}

main().catch(console.error);
