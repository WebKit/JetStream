import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';

// Load Languages
loadLanguages(['markup', 'css', 'javascript', 'clike', 'cpp']);

export function runTest(samples) {
  const results = [];
  for (const { content: data, lang} of samples) {
    const highlighted = Prism.highlight(data, Prism.languages[lang], lang);
    results.push({
      originalSize: data.length,
      highlightedSize: highlighted.length,
    });
  }
  return results;
}