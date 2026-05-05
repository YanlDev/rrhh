import "dotenv/config";
import { ensureMigrated } from "./index";

ensureMigrated().then(() => {
  console.log("✓ Migrations applied");
  process.exit(0);
});
