#!/usr/bin/env node
// Fork off a cluster of bots.
// Connect to player session, and send all of them (and the primary worker) to the specified computation.

import cluster from 'node:cluster';
import { argv } from 'node:process';
import { delay } from './utilities.mjs';
import { player, PlayerView } from './player.mjs';
import { joinMillion } from './demo-join.mjs';

const sessionName = argv[2],
      nBots = argv[3] || 100;
var session, index;
process.on('message', async ({method, parameters}) => {
  switch (method) {
  case 'index':
    index = parameters.index;
    break;
  case 'leave':
    let leaving = session;
    session = null;
    leaving?.leave();
    break;
  case 'join':
    await session?.leave();
    console.log(`bot ${index} joining.`);
    session = await joinMillion(parameters);
    console.log(`bot ${index} joined ${parameters.sessionName} with ${session.model.viewCount} present.`);
    // There's probably no reason to not start computing, but for testing/debugging, we'll start computing on a separate command.
    //await session.view.promiseOutput();
    break;
  case 'compute':
    await session.view.promiseOutput();
    break;
  case 'viewCountChanged':
    break;
  default:
      console.warn(`Unrecognized method ${method}.`);
  }
});
if (cluster.isPrimary) {
  class BotController extends PlayerView {
    async parametersSet({sessionAction, ...parameters}) {
      if (!sessionAction) return;
      for (let bot of bots) {
        bot.send({method: sessionAction, parameters});
        //await delay(1e3);
      };
    }
  }
  const bots = Array.from({length: nBots - 1}, () => cluster.fork()),
        controller = await player(sessionName, {}, BotController);
  console.log(`bot lead joined ${sessionName}/${controller.id} with ${controller.model.viewCount} present.`);
  // Create an object for the primary process, with a send method like the child process have, and add to bots.
  bots.push({process, send: message => process.emit('message', message)});
  bots.forEach((bot, index) => bot.send({method: 'index', parameters: {index}})); // Label each bot, for debugging.
}
