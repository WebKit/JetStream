// console.log = () => {};

globalThis.setTimeout = (callback, timeout) => callback();
globalThis.requestAnimationFrame = (callback) => callback();

// JetStream benchmark.
class Benchmark {
  iterationCount = 0;
  preloaded = {
    fortData: null,
    cannonData: null,
    particlesJson: null,
  };

  constructor(iterationCount) {
    this.iterationCount = iterationCount;
  }

  async init() {
    const [fort, cannon, particles] = await Promise.all([
      JetStream.getBinary(JetStream.preload.PIRATE_FORT_BLOB),
      JetStream.getBinary(JetStream.preload.CANNON_BLOB),
      JetStream.getString(JetStream.preload.PARTICLES_BLOB),
    ]);
    this.preloaded.fortData = fort;
    this.preloaded.cannonData = cannon;
    this.preloaded.particlesJson = JSON.parse(particles);
  }

  async runIteration() {
    const {classNames, cameraRotationLength} = await BabylonJSBenchmark.runComplexScene(
      this.preloaded.fortData,
      this.preloaded.cannonData,
      this.preloaded.particlesJson,
      100
    );
    const lastResult = {
      classNames,
      cameraRotationLength
    };
    this.validateIteration(lastResult);
  }

  validateIteration(lastResult) {
    this.expect("this.lastResult.classNames.length", lastResult.classNames.length, 2135);
    this.expect("this.lastResult.cameraRotationLength", lastResult.cameraRotationLength, 0);
  }

  expect(name, value, expected) {
    if (value != expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}
