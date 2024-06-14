import { joinMillion } from './demo-join.mjs';

// Join the session with the problem specification here.
// Then get the answer, leave the session, and print the answer.

const sessionName = "0",
      session = await joinMillion(sessionName, {
        input: 1,
        numberOfPartitions: 3,
        fanout: 3,

        sessionName,
        //requestedNumberOfBots: 500,
        prepareInputs: './demo-prepare.mjs',
        join: './demo-join.mjs',
        launchBots: './node-bots.mjs',
        compute: './demo-compute.mjs',
        collectResults: './demo-collect.mjs',
        logger: './demo-logger.mjs'
      });
const output = await session.view.promiseOutput();
await session.leave();
console.log('final answer:', output);
