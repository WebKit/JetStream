// Exported from https://github.com/colinhacks/zod.git
// See LICENSEs in the sources.
module.exports = {
  "extends": "./.configs/tsconfig.base.json",
  "compilerOptions": {
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "customConditions": [
      "@zod/source"
    ],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": [
      "node"
    ]
  },
  "include": [
    "***.mts",
    "***.d.ts",
    "***.d.mts",
    "packages/docs"
  ]
};
