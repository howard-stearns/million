import { Croquet, requestAnimationFrame, serializePromises, delay } from './utilities.mjs';
export { Croquet };

class M extends Croquet.Model {}
class V extends Croquet.View {}
M.register(M.name)
console.log(await Croquet.Session.join({
  appId: 'com.gmail.howard.stearns.microverse',
  apiKey: '17GxHzdAvd4INCAHfJoDm39LH6FkmkLa5qdLhGLqA',
  password: "secret",
  name: 'Controller11',
  step: 'manual',
  model: M,
  view: V
}));
