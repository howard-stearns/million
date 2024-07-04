#!/usr/bin/env node
// Create a bunch of bots.
// Connect to player session, and send all of them (and the primary worker) to the specified computation.

const USE_CLUSTER = true;
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
import { joinMillion, ComputationWorker } from './demo-join.mjs';

const sessionName = argv[2],
      nGroups = argv[3] || 16,
      nBotsPerGroup = argv[4] || 1;

var sessions = [], index;
function leaveSessions() {
  console.log(`Bot ${index} leaving ${sessions.length} sessions.`);
  sessions.forEach(session => session.leave());
  sessions = [];
}
function joinSessions(parameters) {
  return Array.from({length: nBotsPerGroup}, () => joinMillion(parameters, {
    viewClass: ComputationWorker,
    logger: './console-logger.mjs',
    detachFromAncestors: false
  }));
}
function computeSessions() {
  return sessions.map((session, index) => {
    return session.view?.promiseOutput();
  });
}

async function handler({method, parameters}) { // JSON-RPC-ish
  console.log(`Bot ${index} received command '${method}'.`);
  switch (method) {
  case 'index':
    index = parameters.index;
    break;
  case 'leave':
    leaveSessions();
    break;
  case 'joinOnly':
    leaveSessions();
    sessions = await Promise.all(joinSessions(parameters));
    console.log(`Bot ${index} joined ${parameters.sessionName} ${nBotsPerGroup}x with ${sessions[0].model.viewCount} present.`);
    break;
  case 'compute':
    computeSessions();
    break;
  case 'joinAndCompute':
    leaveSessions();
    sessions = await Promise.all(joinSessions(parameters));
    console.log(`Computing bot ${index} in ${parameters.sessionName} ${nBotsPerGroup}x with ${sessions[0].model.viewCount} present.`);    
    await Promise.all(computeSessions());
    leaveSessions();
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
  const bots = Array.from({length: nGroups - 1}, makeChild),
        controller = await player(sessionName, {}, BotController);
  console.log(`bot lead joined ${sessionName}/${controller.id} with ${controller.model.viewCount} present.`);
  // Create an object for the primary process, with a send method like the child process have, and add to bots.
  bots.push({post: handler});
  bots.forEach((bot, index) => bot.post({method: 'index', parameters: {index}})); // Label each bot, for debugging.
} else {
  host.on('message', handler);
}
