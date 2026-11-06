// Tiny JSON-file store so a sync never re-analyses (and re-pays for) a chat that hasn't changed.
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const FILE = path.join(DATA_DIR, "reviews.json");

export function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { conversations: {}, knowledgeBase: [], lastSync: null };
  }
}

export function saveStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, FILE);
}
