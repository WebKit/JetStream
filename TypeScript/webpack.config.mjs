import path from "path";
import { fileURLToPath } from "url";
import TerserPlugin from "terser-webpack-plugin";
import UnicodeEscapePlugin  from "@dapplets/unicode-escape-webpack-plugin";
import { LicenseWebpackPlugin } from "license-webpack-plugin";
import * as PathBrowserify from "path-browserify";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const commonConfig = {
  mode: "production",
  devtool: "source-map",
  target: "web",
  entry: path.resolve(__dirname, "src/test.mjs"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    library: {
      name: "TypeScriptCompileTest",
      type: "globalThis",
    },
    libraryTarget: "assign",
  },
  plugins: [
    new UnicodeEscapePlugin({
      test: /\.(js|jsx|ts|tsx)$/, // Escape Unicode in JavaScript and TypeScript files
    }),
    new LicenseWebpackPlugin({
      perChunkOutput: true, 
      outputFilename: "LICENSE.txt",
    }),
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_fnames: true,
        },
      }),
    ],
  },
  resolve: {
    fallback: {
      "path": "path-browserify",
      "fs": false,
    },
  },
};

export default [commonConfig];
