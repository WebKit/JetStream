// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from "fs";
import * as babylon from "babylon";
import nestedRules from "./mocks/nested-rules.mjs";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import * as ts from "typescript";

export const acorn = [
  {
    name: "backbone-1.1.0.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "jquery-3.2.1.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "lodash.core-4.17.4.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "preact-8.2.5.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "redux.min-3.7.2.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "speedometer-es2015-test-2.0.js",
    options: { ecmaVersion: 6, sourceType: "script" }
  },
  {
    name: "underscore-1.8.3.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: { ecmaVersion: 7, sourceType: "module" }
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options: Object.assign(options, { locations: true }, { ranges: true })
}));

export const babel = [
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: { presets: ["es2015"], sourceType: "module" }
  }
].map(({ name, options }) => {
  const code = fs.readFileSync(`third_party/${name}`, "utf8");
  const ast = babylon.parse(code, options);
  return { ast, code, options };
});

export const babelMinify = [
  {
    name: "speedometer-es2015-test-2.0.js",
    options: {}
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options
}));

export const babylonPayload = [
  {
    name: "jquery-3.2.1.js",
    options: { sourceType: "script" }
  },
  {
    name: "lodash.core-4.17.4.js",
    options: { sourceType: "script" }
  },
  {
    name: "preact-8.2.5.js",
    options: { sourceType: "script" }
  },
  {
    name: "redux.min-3.7.2.js",
    options: { sourceType: "script" }
  },
  {
    name: "speedometer-es2015-test-2.0.js",
    options: { sourceType: "script" }
  },
  {
    name: "todomvc/react/app.jsx",
    options: { sourceType: "script", plugins: ["jsx"] }
  },
  {
    name: "todomvc/react/footer.jsx",
    options: { sourceType: "script", plugins: ["jsx"] }
  },
  {
    name: "todomvc/react/todoItem.jsx",
    options: { sourceType: "script", plugins: ["jsx"] }
  },
  {
    name: "underscore-1.8.3.js",
    options: { sourceType: "script" }
  },
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: { sourceType: "module" }
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options
}));

export const buble = [
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: {}
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options: { transforms: { modules: false } }
}));

export const coffeescript = fs.readFileSync(
  "third_party/coffeescript-lexer-2.0.1.coffee",
  "utf8"
);

export const espree = [
  "backbone-1.1.0.js",
  "jquery-3.2.1.js",
  "mootools-core-1.6.0.js",
  "underscore-1.8.3.js"
].map(name => fs.readFileSync(`third_party/${name}`, "utf8"));

export const esprima = [
  "backbone-1.1.0.js",
  "jquery-3.2.1.js",
  "mootools-core-1.6.0.js",
  "underscore-1.8.3.js"
].map(name => fs.readFileSync(`third_party/${name}`, "utf8"));

export const jshint = [
  "lodash.core-4.17.4.js",
  "preact-8.2.5.js",
  "underscore-1.8.3.js"
].map(name => fs.readFileSync(`third_party/${name}`, "utf8"));

export const lebab = [
  {
    name: "preact-8.2.5.js",
    options: [
      "arg-rest",
      "arg-spread",
      "arrow",
      "class",
      "for-of",
      "let",
      "template",
      "includes",
      "obj-method",
      "obj-shorthand"
    ]
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options
}));

const cleaner = postcss([autoprefixer({ add: false, browsers: [] })]);
export const postcssPayload = [
  {
    name: "bootstrap-4.0.0.css",
    options: { from: `third_party/${this.name}`, map: false }
  },
  {
    name: "foundation-6.4.2.css",
    options: { from: `third_party/${this.name}`, map: false }
  },
  {
    name: "angular-material-1.1.8.css",
    options: { from: `third_party/${this.name}`, map: false }
  }
].map(({ name, options }) => {
  // Clean prefixes.
  const source = fs.readFileSync(`third_party/${name}`, "utf8");
  // Add some nested rules.
  const css = cleaner.process(source).css + nestedRules;

  return {
    payload: css,
    options
  };
});

export const prepack = [
  "third_party/preact-8.2.5.js",
  "third_party/redux.min-3.7.2.js"
].map(filePath => ({
  filePath,
  fileContents: fs.readFileSync(filePath, "utf8")
}));

export const prettier = [
  {
    name: "preact-8.2.5.js",
    options: { semi: false, useTabs: false }
  },
  {
    name: "lodash.core-4.17.4.js",
    options: { semi: true, useTabs: true }
  },
  {
    name: "todomvc/react/app.jsx",
    options: { semi: false, useTabs: true }
  },
  {
    name: "todomvc/react/footer.jsx",
    options: { jsxBracketSameLine: true, semi: true, useTabs: true }
  },
  {
    name: "todomvc/react/todoItem.jsx",
    options: { semi: false, singleQuote: true, useTabs: true }
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options
}));

export const sourceMap = [
  "lodash.min-4.17.4.js.map",
  "preact-8.2.5.js.map",
  "source-map.min-0.5.7.js.map",
  "underscore.min-1.8.3.js.map"
].map(name => fs.readFileSync(`third_party/${name}`, "utf8"));

export const terser = [
  {
    name: "speedometer-es2015-test-2.0.js",
    options: { compress: { passes: 1, sequences: false } }
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options
}));

export const typescript = [
  {
    // Compile typescript-angular.ts to ES3 (default)
    name: "todomvc/typescript-angular.ts",
    transpileOptions: {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES3
      }
    }
  },
  {
    // Compile typescript-angular.ts to ESNext (latest)
    name: "todomvc/typescript-angular.ts",
    transpileOptions: {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ESNext
      }
    }
  }
].map(({ name, transpileOptions }) => ({
  input: fs.readFileSync(`third_party/${name}`, "utf8"),
  transpileOptions
}));
