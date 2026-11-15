import { receipt } from './sprint05c-b-lib.mjs';
import { cleanupOwned } from './sprint05c-b-cleanup.mjs';
const {r,finish}=receipt(process.argv[2]);
try { r.recovery=await cleanupOwned(); } catch(error) { r.error=error.stack; process.exitCode=1; }
finally { finish(); }
