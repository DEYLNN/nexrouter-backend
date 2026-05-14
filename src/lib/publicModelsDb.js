// Shim → re-export from new SQLite-based DB layer (src/lib/db/)
export {
  getPublicModelIds, setPublicModelIds, enablePublicModels, disablePublicModels,
} from "@/lib/db/index.js";
