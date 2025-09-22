
import { exec as exec_callback } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import fs from fs;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function findPackageJsonFiles(dir, accumulator=[]) {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirEntries) {
        if (dirent.name === 'node_modules' || dirent.name === '.git')
            continue;
        const res = join(dir, dirent.name);
        if (dirent.isDirectory()) {
            findPackageJsonFiles(res, accumulator);
        }
        if (dirent.name === 'package.json') {
            accumulator.push(res)
        }
    }
    return accumulator;
}

async function main() {
    const packageJsonFiles = await findPackageJsonFiles(root);
    for (const file of packageJsonFiles) {
        const content = await readFile(file, 'utf-8');
        const packageJson = JSON.parse(content);
        if (packageJson.scripts && packageJson.scripts.build) {
            const dir = dirname(file);
            console.log(`Found build script in ${dir}`);
            try {
                console.log(`Running "npm install" in ${dir}...`);
                await exec('npm install', { cwd: dir });
                console.log(`Running "npm run build" in ${dir}...`);
                await exec('npm run build', { cwd: dir });
                console.log(`Successfully built ${packageJson.name}`);
                console.log('Resetting repository...');
                await exec('git reset --hard');
                console.log('Repository reset.');
            } catch (e) {
                console.error(`Failed to build ${packageJson.name}: ${e}`);
                process.exit(1);
            }
        }
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
