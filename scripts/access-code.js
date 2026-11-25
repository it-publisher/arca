// Reads a server token from stdin and prints an access code "<token>.<history key>".
// Run once per person: a new code means a new history key, and notes made with the old one
// stop showing up in that person's list.
import { createAccessCode } from '../shared/client.js';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const token = Buffer.concat(chunks).toString('utf8').trim();
if (!token) {
  process.stderr.write('Usage: <token on stdin> | npm run -s access-code\n');
  process.exit(1);
}
process.stdout.write(await createAccessCode(token));
