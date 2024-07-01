#!/usr/bin/env node
// Create a bunch of bots.
// Connect to player session, and send all of them (and the primary worker) to the specified computation.

const USE_CLUSTER = false;
var host, isHost, makeChild;
if (USE_CLUSTER) {
  const cluster = await import('node:cluster');
  host = process;
  isHost = cluster.isPrimary;
  makeChild = () => {
    const child = cluster.fork();
    return {post(data) { child.send(data); }};
  };
} else {
  const { Worker, isMainThread, parentPort } = await import('node:worker_threads');
  const { fileURLToPath } = await import('node:url');
  host = parentPort;
  isHost = isMainThread;
  makeChild = () => {
    const child = new Worker(fileURLToPath(import.meta.url));
    return {post(data) { child.postMessage(data); }};
  }
}
  
import { argv } from 'node:process';
import { delay } from './utilities.mjs';
import { player, PlayerView } from './player.mjs';
import { joinMillion } from './demo-join.mjs';

const sessionName = argv[2],
      nBots = argv[3] || 100;
var session, index;
async function handler({method, parameters}) { // JSON-RPC-ish
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
}

if (isHost) {
  class BotController extends PlayerView {
    async parametersSet({sessionAction, ...options}) {
      if (!sessionAction) return;
      for (let bot of bots) {
        bot.post({method: sessionAction, parameters: options});
        //await delay(1e3);
      };
    }
  }
  const bots = Array.from({length: nBots - 1}, makeChild),
        controller = await player(sessionName, {}, BotController);
  console.log(`bot lead joined ${sessionName}/${controller.id} with ${controller.model.viewCount} present.`);
  // Create an object for the primary process, with a send method like the child process have, and add to bots.
  bots.push({post: handler});
  bots.forEach((bot, index) => bot.post({method: 'index', parameters: {index}})); // Label each bot, for debugging.
} else {
  host.on('message', handler);
}
