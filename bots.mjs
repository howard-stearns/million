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
process.on('message', async ({method, parameters}) => { // JSON-RPC-ish
  switch (method) {
  case 'index':
    index = parameters.index;
    break;
  case 'leave':
    let leaving = session;
    session = null;
    leaving?.leave();
    break;
  case 'joinOnly':
    await session?.leave();
    session = await joinMillion(parameters);
    console.log(`bot ${index} joined ${parameters.sessionName} with ${session.model.viewCount} present.`);
    break;
  case 'compute':
    await session?.view.promiseOutput();
    break;
  case 'joinAndCompute':
    session = await joinMillion(parameters);
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
    async parametersSet({sessionAction, ...options}) {
      if (!sessionAction) return;
      for (let bot of bots) {
        bot.send({method: sessionAction, parameters: options});
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
