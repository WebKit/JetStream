import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  entry: "./src/index.mjs",
  mode: "production",
  devtool: "source-map",
  target: ["web", "es6"],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    library: {
      name: "EChartsBenchmark",
      type: "globalThis",
    },
    libraryTarget: "assign",
    chunkFormat: "commonjs",
  },
  resolve: {
    fallback: {
      fs: false,
      path: false,
      util: false,
      assert: false,
    },
  },
};
