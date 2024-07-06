import { player, PlayerView, Croquet, join } from './player.mjs';

class M extends Croquet.Model {}
class V extends Croquet.View {}
M.register(M.name)
console.log(await join({
  name: 'Controller11',
  step: 'manual',
  model: M,
  view: V
}));
//console.log(await player('Controller11'b));
