import { Croquet, join } from './administrivia.mjs';
export { Croquet };

class M extends Croquet.Model {}
class V extends Croquet.View {}
M.register(M.name)
console.log(await join({
  name: 'Controller11',
  step: 'manual',
  model: M,
  view: V
}));
