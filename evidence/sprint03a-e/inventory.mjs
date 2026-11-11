import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const output = 'evidence/sprint03a-e';
const inventory = [];
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (entry.name !== 'SHA256SUMS') inventory.push(`${hash(file)}  ${file}`);
  }
}
collect(output);
inventory.push(`${hash('docs/reports/sprint03a-e-independent-review.md')}  docs/reports/sprint03a-e-independent-review.md`);
fs.writeFileSync(`${output}/SHA256SUMS`, inventory.sort().join('\n') + '\n');
console.log(`Bound ${inventory.length} reviewer report/evidence files; inventory excludes itself.`);
