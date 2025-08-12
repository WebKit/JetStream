import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

export async function load(url, context, defaultLoad) {
  const { format } = context;
  if (url.endsWith('.csv') || url.endsWith('.js')) {
    const path = fileURLToPath(url);
    const content = await readFile(path, 'utf-8');
    return {
      source: `export default ${JSON.stringify(content)};`,
      format: 'module',
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
