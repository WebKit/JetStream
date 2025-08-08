const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, "..", "dist", "react-render-test.js");
const srcOutPath = path.join(__dirname, "..", "dist", "react-render-test.src.js");

const bundleContent = fs.readFileSync(bundlePath, "utf8");
const srcContent = `REACT_RENDER_TEST_SRC = ${JSON.stringify(bundleContent)};`;
fs.writeFileSync(srcOutPath, srcContent);

const stats = fs.statSync(srcOutPath);
const fileSizeInKiB = (stats.size / 1024) | 0;  
console.info(`Exported loadable src string`);
console.info(`   File:       ${path.relative(process.cwd(), srcOutPath)}`);
console.info(`   Total Size: ${fileSizeInKiB} KiB`);