const fs = require("fs");
const path = require("path");


function stringify(inputFile, outputFile) {
  const bundlePath = path.join(__dirname, "..", "dist", inputFile);
  const srcOutPath = path.join(__dirname, "..", "dist", outputFile);

  const bundleContent = fs.readFileSync(bundlePath, "utf8");
  const srcContent = `REACT_RENDER_TEST_SRC = ${JSON.stringify(bundleContent)};`;
  fs.writeFileSync(srcOutPath, srcContent);

  const stats = fs.statSync(srcOutPath);
  const fileSizeInKiB = (stats.size / 1024) | 0;
  console.info(`Exported loadable src string`);
  console.info(`   File:       ${path.relative(process.cwd(), srcOutPath)}`);
  console.info(`   Total Size: ${fileSizeInKiB} KiB`);
}

stringify("react-render-test.minified.js", "react-render-test.minified.src.js");
stringify("react-render-test.js", "react-render-test.src.js");