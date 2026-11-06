// Run a sync from the command line (e.g. from cron):  npm run sync -- --days 7 [--reanalyze]
import "dotenv/config";
import { startSync, syncStatus } from "./sync.js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const timer = setInterval(() => {
  process.stdout.write(`\r${syncStatus.message} ${syncStatus.done}/${syncStatus.total}   `);
}, 1000);

try {
  await startSync({
    days: Number(flag("days") || 7),
    reanalyze: args.includes("--reanalyze"),
    maxConversations: Number(flag("max") || process.env.SYNC_MAX_CONVERSATIONS || 200),
    concurrency: Number(process.env.SYNC_CONCURRENCY || 3),
  });
  clearInterval(timer);
  console.log(`\n${syncStatus.message}`);
} catch (err) {
  clearInterval(timer);
  console.error(`\nSync failed: ${err.message}`);
  process.exit(1);
}
