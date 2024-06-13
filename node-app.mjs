import { joinMillion } from './demo-join.mjs';

// Join the session with the problem specification here.
// Then get the answer, leave the session, and print the answer.

const sessionName = Math.random().toString(),
      session = await joinMillion(sessionName, {
        input: 1,
        sessionName,
        requestedNumberOfBots: 500,
        fanout: 1000,
        prepareInputs: './demo-prepare.mjs',
        launchBots: './node-bots.mjs',
        compute: './demo-compute.mjs',
        collectResults: './demo-collect.mjs'
      });
await session.view.promiseOutput();
const output = session.model.output;
await session.leave();
console.log('final answer:', output);
