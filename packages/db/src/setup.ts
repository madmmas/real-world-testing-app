import { config } from "dotenv";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

config({ path: resolve(import.meta.dirname, "../../../.env") });

const env = { ...process.env };
const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env,
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);
const seed = spawnSync("pnpm", ["exec", "tsx", "src/seed.ts"], { stdio: "inherit", env });
process.exit(seed.status ?? 0);
