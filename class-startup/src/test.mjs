import * as BABYLON from '@babylonjs/core'


export function runTest() {
  console.log(BABYLON.AssetContainer)
  const allClassNames = Object.values(BABYLON).map(cls => cls.name);
  return allClassNames;
}