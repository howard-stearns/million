#!/usr/bin/env node
// Create a bunch of bots.
// Connect to player session, and send all of them (and the primary worker) to the specified computation.

// Controls whether bots stay connected to ancestor sessions as they do work further down the tree.
// If detaching, there are fewer bots connected to sessions near the root throughout the computation,
// but incurs some overhead to reconnect to these sessions.
const DETACH_FROM_ANCESTORS = true;

// Controls whether bots eagerly spread themselves out over the first level sessions as soon as we learn the
// proposed numberOfPartitions and fanout. When false, all the bots try to connect to the root (zero-level) session
// when computation starts, which can be a lot to all connect at once.
//
// TODO:
// - Compute the prejoin numberOfPartitions properly when the total is either more or less than the capacity at this level.
// - Long term - can we support "idling" bots by moving the operating paramters outside the session options, and instead
//   communicate them to members as the "currentOptions" (similarly to Player  -- and indeed, maybe get rid of Player)?
const PRE_JOIN_NEXT_LEVEL = true;

// Controls whether we use https://nodejs.org/docs/latest/api/cluster.html or https://nodejs.org/docs/latest/api/worker_threads.html
// for nGroups. (nBotsPerGroup run within each of the groups. Note that you can run with ./bots.mjs 1 10, or ./bots.mjs 10 1, etc.
const USE_CLUSTER = true;

var host, isHost, makeChild;
var fixmeReceiver;
if (USE_CLUSTER) {
  const cluster = await import('node:cluster');
  fixmeReceiver = cluster.default;
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
import { player, PlayerView } from './player.mjs';
import { joinMillion, ComputationWorker, Computation, Croquet } from './demo-join.mjs';

const controllerSessionName = argv[2],
      nGroups = argv[3] || 16,
      nBotsPerGroup = argv[4] || 1,
      offset = argv[5] || 0;

var sessions = [], index = '-';
function leaveSessions() { // Leave all our group's sessions (all elements of sessions array).
  if (sessions.length) console.log(`Group ${index} leaving ${sessions.length} sessions.`);
  let promises = sessions.map(session => session.leave());
  sessions = [];
  return promises;
}
const viewOptions = { // Options peculiar to bots. Not part of model.
  viewClass: ComputationWorker,
  //logger: './console-logger.mjs',
  detachFromAncestors: DETACH_FROM_ANCESTORS
};
function joinSessions(parameters) { // Answer a list of promises for nBotsPerGroup sessions.
  return  Array.from({length: nBotsPerGroup}, (_, index) => {
    return joinMillion(parameters, viewOptions);
  });
}
function computeSessions() { // Compute all elements of sessions array.
  return sessions.map(async (session, index) => {
    const output = await session.view?.promiseOutput();
    if (PRE_JOIN_NEXT_LEVEL) { // TODO? - Can this be incorporated into index.mjs?
      const parentOptions = session.model.parentOptions,
            indexInParent = session.view.indexInParent();
      let message = {method: 'finished', parameters: {indexInParent, output}};
      // Having everyone rejoin the root session to report their results is expensive. (About 2 seconds per join.)
      // Here we have leaft bot 0 attached to the root as an "observer", and we report our results through that.
      process.send?.(message) || handler(message);
      // If we were rejoining....
      // await session.leave();
      // session = sessions[index] = await joinMillion(parentOptions, viewOptions);
      // session.view.setPartitionOutput(indexInParent, output);
      // console.log(`Reported ${indexInParent}, ${session.model.completed.reduce((sum, done) => done ? sum+1 : sum), 0}/${session.model.fanout} completed.`);
      // session.view.promiseOutput(); // Don't wait
    }
    return output;
  });
}

var observer, observerCountdown;
function prejoin({version, ...parameters}) { // See PRE_JOIN_NEXT_LEVEL
  let sessionName = parameters.prefix + version,
      total = parameters.numberOfPartitions,
      fanout = parameters.fanout,
      parentOptions = { // Match the order used by index.html
        ...parameters,
        sessionName,
        version
      };
  if (!index) {
    observer?.leave();
    joinMillion(parentOptions, viewOptions).then(session => observer = session);
    observerCountdown = fanout;
  }
  return Array.from({length: nBotsPerGroup},
                    async (_, subIndex) => {
                      const partitionIndex = (index * nBotsPerGroup + subIndex + offset) % fanout;
                      return joinMillion({
                        ...parentOptions,
                        numberOfPartitions: Computation.numberAtIndex(total, Computation.partitionCapacity(total, fanout), partitionIndex),
                        sessionName: `${sessionName}-${partitionIndex}`,
                        version,
                        parentOptions
                      }, viewOptions);
                    });
}

var start;
async function handler({method, parameters}) { // JSON-RPC-ish handler for communications from host to child processes/worker-threads.
  // There are more options here than we use in any one configuration.
  //console.log(`Group ${index} received command '${method}'.`);
  switch (method) {
  case 'finished':
    let {indexInParent, output} = parameters;
    console.log(`Leader learned that ${indexInParent} completed in ${((Date.now() - start)/1e3).toFixed(1)} seconds, with ${--observerCountdown} remaining.`);
    observer.view.setPartitionOutput(indexInParent, output);
    if (!observerCountdown) observer.view.promiseOutput();
    break;
  case 'index':
    index = parameters.index;
    break;
  case 'leave':
    leaveSessions();
    break;
  case 'joinOnly':
    await Promise.all(leaveSessions());
    sessions = await Promise.all(joinSessions(parameters));
    console.log(`Group ${index} joined ${parameters.sessionName} ${nBotsPerGroup}x with ${sessions[0].model.viewCount} present.`);
    break;
  case 'compute':
    computeSessions();
    break;
  case 'joinAndCompute':
    start = Date.now();
    if (!PRE_JOIN_NEXT_LEVEL) {
      await Promise.all(leaveSessions());
      sessions = await Promise.all(joinSessions(parameters));
      console.log(`Computing bot ${index} in ${parameters.sessionName} ${nBotsPerGroup}x with ${sessions[0].model.viewCount} present.`);
    }
    await Promise.all(computeSessions());
    leaveSessions();
    break;
  case 'viewCountChanged':
    break;
  case null:
    await Promise.all(leaveSessions());
    if (PRE_JOIN_NEXT_LEVEL) {
      if (isHost) console.log(`Bot lead preparing bots... Please wait.`);
      sessions = await Promise.all(prejoin(parameters));
      console.log(`Bot group ${index} is ready with ${sessions.length} sessions.`);
    }
    break;
  default:
      console.warn(`Unrecognized method ${method}.`);
  }
}

if (isHost) { // Host joins player session to get told what to do, which it then messages to each process/worker-thread.
  console.log(`Usage: ${argv[1]} controllerSessionName nGroups (default: 16) nBotsPerGroup (default 1) offset (default 0)`);
  if (controllerSessionName) console.log(`Creating ${nGroups} ${USE_CLUSTER ? "clusters" : "worker threads"} of ${nBotsPerGroup} bots each.`);
  else process.exit(1);
  class BotController extends PlayerView {
    async parametersSet({sessionAction, ...options}) {
      for (let group of groups) {
        group.post({method: sessionAction, parameters: options});
      };
    }
  }
  const groups = Array.from({length: nGroups - 1}, makeChild),
      controller = await player(controllerSessionName, {}, BotController);
  console.log(`Bot lead joined ${controllerSessionName}/${controller.id} with ${controller.model.viewCount} present.`);
  // Create an object for the primary process/thread, with a post method like the child process/thread have, and add to groups.
  groups.unshift({post: handler});

  fixmeReceiver.on('message', (_, message) => handler(message));

  groups.forEach((group, index) => group.post({method: 'index', parameters: {index}})); // Label each bot, for debugging.
} else {
  host.on('message', handler);
}
