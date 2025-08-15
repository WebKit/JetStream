// console.log = () => {};

// JetStream benchmark.
class Benchmark {
  iterationCount = 0;
  lastResult = {};
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
      getBinary(PIRATE_FORT_BLOB),
      getBinary(CANNON_BLOB),
      getString(PARTICLES_BLOB),
    ]);
    this.preloaded.fortData = fort;
    this.preloaded.cannonData = cannon;
    this.preloaded.particlesJson = JSON.parse(particles);
  }

  async runIteration() {
    const classNames = await BabylonJSBenchmark.runComplexScene(
      this.preloaded.fortData,
      this.preloaded.cannonData,
      this.preloaded.particlesJson,
      100
    );
    this.lastResult = {
      classNames,
    };
  }

  validate() {
    this.expect("Exported Classes", this.lastResult.classNames.length, 2135);
  }

  expect(name, value, expected) {
    if (value != expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}
