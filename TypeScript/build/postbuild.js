const fs = require("fs");
const path = require("path");

console.log("Creating importable source string")
const bundlePath = path.join(__dirname, "..", "dist", "typescript-compile-test.js");
const srcOutPath = path.join(__dirname, "..", "dist", "typescript-compile-test.src.js");

const bundleContent = fs.readFileSync(bundlePath, "utf8");
const srcContent = `REACT_RENDER_TEST_SRC = ${JSON.stringify(bundleContent)};`;
fs.writeFileSync(srcOutPath, srcContent);
console.log(`Successfully created ${srcOutPath}`);