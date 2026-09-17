import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";

async function main() {
  const app = createApp();

  // Verify database connection before accepting traffic
  await prisma.$connect();
  console.log("✅ Database connected");

  app.listen(env.PORT, () => {
    console.log("");
    console.log("🚀 DebugDiary Backend is running!");
    console.log(`   Local:   http://localhost:${env.PORT}`);
    console.log(`   Health:  http://localhost:${env.PORT}/health`);
    console.log(`   Mode:    ${env.NODE_ENV}`);
    console.log("");
  });
}

main().catch((err) => {
  console.error("❌ Failed to start server:", err.message);
  process.exit(1);
});
