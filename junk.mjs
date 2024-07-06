//import { player, PlayerView, Croquet, join } from './player.mjs';
import { PlayerModel, Croquet, join } from './player.mjs';
PlayerModel.register('PlayerModel');
class M extends Croquet.Model {}
class V extends Croquet.View {}

console.log(await join({
  name: 'Controller11',
  step: 'manual',
  model: M,
  view: V
}));
//console.log(await player('Controller11'b));
