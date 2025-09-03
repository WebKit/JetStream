import Prism from "prismjs";
import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-clike.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-c.js";
import "prismjs/components/prism-cpp.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-typescript.js";

export function runTest(samples) {
  const results = [];
  for (const { content, lang } of samples) {
    const highlighted = Prism.highlight(content, Prism.languages[lang], lang);
    results.push({
      html: highlighted,
    });
  }
  return results;
}
