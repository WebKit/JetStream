import * as BABYLON from "@babylonjs/core";

export function runTest(frames=10) {
  const allClassNames = Object.values(BABYLON).map((cls) => cls.name);
  BABYLON.Logger.LogLevels = BABYLON.Logger.NoneLogLevel;
  const engine = new BABYLON.NullEngine();
  const scene = createScene(engine);
  for (let i = 0; i < frames; i++) {
    scene.render();
  }
  return allClassNames;
}

function createScene(engine) {
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.FreeCamera(
    "camera1",
    new BABYLON.Vector3(0, 5, -10),
    scene
  );
  camera.setTarget(BABYLON.Vector3.Zero());
  const light = new BABYLON.HemisphericLight(
    "light1",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  const sphere = BABYLON.MeshBuilder.CreateSphere(
    "sphere1",
    { segments: 16, diameter: 2, sideOrientation: BABYLON.Mesh.FRONTSIDE },
    scene
  );
  sphere.position.y = 1;
  const ground = BABYLON.MeshBuilder.CreateGround(
    "ground1",
    { width: 6, height: 6, subdivisions: 2, updatable: false },
    scene
  );
  return scene;
}
