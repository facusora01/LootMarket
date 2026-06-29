// Loader minimo de server/.env, sin dependencias (ISO 27001 A.5.17 / A.8.24:
// los secretos se cargan del entorno, no del codigo). Debe importarse PRIMERO,
// antes que db.js, para que las variables esten disponibles al evaluar el pool.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Quita comillas envolventes si las hay.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // No pisa variables ya definidas en el entorno real (tienen prioridad).
    if (process.env[key] === undefined && val !== '') {
      process.env[key] = val;
    }
  }
}
