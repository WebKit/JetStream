const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');

const repoUrl = 'https://github.com/jestjs/jest.git';
const repoDir = 'jest';

// 1. Clone the repository
if (!fs.existsSync(repoDir)) {
  console.log('Cloning Jest repository...');
  execSync('git clone ' + repoUrl + ' ' + repoDir);
} else {
  console.log('Jest repository already exists. Skipping clone.');
}

// 2. Read all files from packages/* into memory
console.log('Reading files from packages into memory...');
const fileContents = {};
const files = glob.sync('packages/**/*.ts', { cwd: repoDir, nodir: true });

files.forEach(file => {
  const filePath = path.join(repoDir, file);
  fileContents[file] = fs.readFileSync(filePath, 'utf8');
});

// 3. Create the jets_src.js module
fs.writeFileSync(
  'src/jets_src.js',
  'module.exports = ' + JSON.stringify(fileContents, null, 2) + ';'
);
console.log('Created src/jets_src.js');

// 4. Extract and create the jets_tsconfig.js module
console.log('Extracting tsconfig.json...');
const tsconfigPath = path.join(repoDir, 'tsconfig.json');
const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
const tsconfig = JSON.parse(tsconfigContent.replace(/(?:^|\s)\/\/.*$|\/\*[\s\S]*?\*\//gm, ''));

fs.writeFileSync(
  'src/jets_tsconfig.js',
  'module.exports = ' + JSON.stringify(tsconfig, null, 2) + ';'
);
console.log('Created src/jets_tsconfig.js');

console.log('Build process complete.');