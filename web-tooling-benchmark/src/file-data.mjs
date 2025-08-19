// Copyright 2023 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from "fs";

const fileNames = [
  "backbone-1.1.0.js",
  "jquery-3.2.1.js",
  "lodash.core-4.17.4.js",
  "preact-8.2.5.js",
  "redux.min-3.7.2.js",
  "speedometer-es2015-test-2.0.js",
  "underscore-1.8.3.js",
  "vue.runtime.esm-nobuble-2.4.4.js",
  "todomvc/react/app.jsx",
  "todomvc/react/footer.jsx",
  "todomvc/react/todoItem.jsx",
  "coffeescript-lexer-2.0.1.coffee",
  "mootools-core-1.6.0.js",
  "bootstrap-4.0.0.css",
  "foundation-6.4.2.css",
  "angular-material-1.1.8.css",
  "lodash.min-4.17.4.js.map",
  "preact-8.2.5.js.map",
  "source-map.min-0.5.7.js.map",
  "underscore.min-1.8.3.js.map",
  "todomvc/typescript-angular.ts"
];

const fileData = {};
for (const name of fileNames) {
  fileData[name] = fs.readFileSync(`third_party/${name}`, "utf8");
}

export default fileData;
