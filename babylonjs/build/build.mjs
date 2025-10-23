
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNIPPET_URL = 'https://snippet.babylonjs.com/LCBQ5Y/6';
const RAW_SNIPPET_PATH = path.resolve(__dirname, '../data/snippets.LCBQ5Y.raw.json');
const PARTICLES_PATH = path.resolve(__dirname, '../data/particles.json');

async function main() {
  const response = await fetch(SNIPPET_URL);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  const snippetJson = await response.json();

  console.log(`Saving raw snippet: ${RAW_SNIPPET_PATH}`);
  fs.writeFileSync(RAW_SNIPPET_PATH, JSON.stringify(snippetJson));

  const jsonPayload = JSON.parse(snippetJson.jsonPayload);
  const particleSystem = JSON.parse(jsonPayload.particleSystem);

  console.log(`Saving particles: ${PARTICLES_PATH}:`);
  fs.writeFileSync(PARTICLES_PATH, JSON.stringify(particleSystem, null, 2));
}

main();
