#!/usr/bin/env node
// Fork off a cluster of bots.
// Connect to player session, and send all of them (and the primary worker) to the specified computation.

import cluster from 'node:cluster';
import { argv } from 'node:process';
import { delay } from './utilities.mjs';
import { player } from './player.mjs';
import { joinMillion } from './demo-join.mjs';

const sessionName = argv[2],
      nBots = argv[3] || 100;
var session;
process.on('message', async ({method, parameters}) => {
  console.log({method, parameters});
  switch (method) {
  case 'leave':
    let leaving = session;
    session = null;
    leaving?.leave();
    break;
  case 'join':
    console.log('joining', parameters.sessionName);    
    await session?.leave();
    session = await joinMillion(parameters);
    console.log(`bot joined ${parameters.sessionName} with ${session.model.viewCount} present.`);
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
  async function control({sessionAction, ...parameters}) {
    if (!sessionAction) return;
    for (let bot of bots) {
      bot.send({method: sessionAction, parameters});
      await delay(200);
    };
  }
  const bots = Array.from({length: nBots - 1}, () => cluster.fork()),
        controller = await player(sessionName, {}, control);
  let {name, id, persistentId, versionId} = controller;
  console.log({name, id, persistentId, versionId});
  console.log(`bot lead joined ${sessionName} with ${controller.model.viewCount} present.`);
  bots.push({process, send: message => process.emit('message', message)}); // Us, too.
}
