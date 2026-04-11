import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "build");

if (!fs.existsSync(buildDir)) {
  console.error("Build directory not found. Run npm run build first.");
  process.exit(1);
}

for (const entry of fs.readdirSync(buildDir)) {
  const src = path.join(buildDir, entry);
  const dest = path.join(root, entry);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log("Frontend build copied to project root.");
