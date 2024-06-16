// Join the session with the problem specification here.
// Then get the answer, leave the session, and print the answer.


// Example:
//   fanout = 100
//   total = 100^3 = 1,000,000
// root session "0" has 100 coordinating sessions:
//   "0-0" has 100 coordinating sessions:
//     "0-0-0" has 100 computations
//        computing partition 0
//        computing partition 1
//        ...
//        computing partition 99
//     "0-0-1"
//      ...
//     "0-0-99"
//   "0-1"
//   ...
//   "0-99"
//
//  So there are 10,101 sessions. Each session can have partipants that vary from 0 to over 100 connections at a time.
//  For the lowest tier, e.g., "0-0-0", each partipant does one computed partition at a time:
//     If there 100 partipants (including the first), than each computation is assigned to be worked in parallel.
//     If there are less, then a partipant will be assigned an available partition, and then another when that is completed, etc.
//     If there are more, then there are extras working on the same partition, which will be used if someone drops out.
//  For intermediate tiers, like "0-0", each of the 100 internal partitions is doing two things:
//     Joining the assigned partition one level down, e.g., "0-0-0". Initially, this will be creating it and setting up it's
//        data and launching any bots to work that level's partitions ("0-0-0"). It then works that session just like any other.
//     Reporting that result to what it first joined ("0-0"). So it's going to be pretty idle in that upper session, even as it
//        works the lower session.

//  Some data points, using https://github.com/kilroy-code/croquet-in-memory so that there are no network connections, but a
//  a heck of a lot of memory usage.
//
//  With one bot per partition, but running in the same node instance:
//  - Peak efficiency for one level of computation is about 200 nodes, averaging about 10 ms/partition.
//    Higher falls of due to garbage collection and non-networked message-passing. E.g., 11 ms/partition for 250 nodes
//    Lower falls off due to overhead being distributed over fewer partitions. E.g., 11 ms/partition for 150 nodes.
//  - Two full levels peaks at about 45 partitions per level, averaging about 2 ms/partition.
//  - Three full levels peaks at only 10 partitions per level, presumably from memory pressure, for about 2 ms/partition.
//      My laptop can do fanout=20 in 45 seconds (6 ms/parition), but fanout=30 is mired in overhead.
//  - Four levels peaks at a fanout of just 6.
//
//  But using half the number of bots (fanout/2 at each parition), there's a lot less overhead. At three levels:
//    fanout=30 => 74 seconds, 3 ms/partition
//    fanout=35 => 140 seconds, 3 ms/partition
//  And with fanout/4 bots per partition:
//    fanout=35 => 76 seconds, 2 ms/partition
//    faount=40 => 87 seconds, 1 ms/partition
//  Fixing number of bots at 10 (plus the node that starts each session):
//    fanout=50 => 167 seonds, 1 ms/partition
//    fanout=60 => 273 seconds, 1 ms/partition
//  If we then remove the delay in demo-compute, so that we are "pure overhead" (still 10 bots / level)
//    fanout=60 => 137 seconds, 1 ms/partition (or about 4 second less with no printing, which is turned off for the following)
//    fanout=70 => 185 seconds, 0.5 ms/partition
//    fanout=80 => 300 seconds, 0.6 ms/partition
//    fanout=90 => 439 seconds, 0.6 ms/partition
//    fanout=100 => 965 seconds, 1 ms/partition
//  But... that was stupid. 10 bots / intermediate partition is 11 partipants in the session, working over 100 partitions, which is wasteful.
//  So, adding only 9 bots / session is only 431 seconds, or less than 0.5 ms/partition

// So, in this configuration (all on one NodeJS process on a laptop), a computation of a million parts takes 7.2 minutes of overhead.

import { joinMillion } from './demo-join.mjs';

const fanout = 10, // 100 for a million partitions. Probably want to comment out the delay in demo-compute.mjs!
      total = Math.pow(fanout, 3),
      start = Date.now(),
      session = await joinMillion({
        sessionName: "0",
        input: 1,
        //logger: './demo-logger.mjs',

        numberOfPartitions: total,
        fanout,
        requestedNumberOfBots: 9,
        //requestedNumberOfBots: Math.floor(fanout / 4),
        //requestedNumberOfBots: fanout-1,        

        prepareInputs: './demo-prepare.mjs',
        join: './demo-join.mjs',
        launchBots: './node-bots.mjs',
        compute: './demo-compute.mjs',
        collectResults: './demo-collect.mjs'
      });
const output = await session.view.promiseOutput();
await session.leave();
const elapsed = Date.now() - start;
console.log(`final answer: ${output}, overhead levels: ${session.model.remainingLevels || 0}, fanout: ${fanout}, elapsed: ${elapsed}, per part: ${elapsed/total}`);
