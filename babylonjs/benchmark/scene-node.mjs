import { runComplexScene } from "../src/babylon-js-benchmark.mjs";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fortPath = path.resolve(__dirname, "../data/pirateFort.glb");
const cannonPath = path.resolve(__dirname, "../data/cannon.glb");
const particlePath = path.resolve(__dirname, "../data/particles.json");

async function main() {
    try {
    const fortBuffer = await fs.readFile(fortPath);
    const cannonBuffer = await fs.readFile(cannonPath);
    const particleData = JSON.parse(await fs.readFile(particlePath, "utf-8"))
    const {classNames, cameraRotationLength} = await runComplexScene(fortBuffer, cannonBuffer, particleData, 1000);
    } catch(e) {
        console.error(e);
        console.error(e.stack);
    }
}

main();
