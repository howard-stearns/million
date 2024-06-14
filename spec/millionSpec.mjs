import { joinMillion } from '../demo-join.mjs';


describe("Million", function () {
  let timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  beforeAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 15e3;
  })
  afterAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout;
  });
  function test1(label, numberOfPartitions, fanout, requestedNumberOfBots) {
    it(label, async function () {
      const sessionName = "0",
            session = await joinMillion(sessionName, {
              input: 1,
              numberOfPartitions,
              fanout,
              sessionName,
              requestedNumberOfBots,
              prepareInputs: './demo-prepare.mjs',
              join: './demo-join.mjs',
              launchBots: './node-bots.mjs',
              compute: './demo-compute.mjs',
              collectResults: './demo-collect.mjs'
            }, {
              logger: null
            }),
            output = await session.view.promiseOutput();
      //console.log(`${numberOfPartitions} % ${fanout} => ${output} (${requestedNumberOfBots} bots)`);
      expect(output).toBe(numberOfPartitions);
      await session.leave();
    });
  }
  function bakersDozen(label, fanout, requestedNumberOfBots) {
    describe(label, function () {
      for (let n = 0; n <= 12; n++) {
        test1(`${n} partitions`, n, fanout, requestedNumberOfBots);
      }
    });
  }
  function multiLevel(label, requestedNumberOfBots) {
    describe(label, function () {
      for (let n = 2; n <= 3; n++) {
        bakersDozen(`fanout ${n},`, n, requestedNumberOfBots);
      }
    });
  }
  //multiLevel("no bots", 0);
  multiLevel("one bot", 1);
  //multiLevel("two bots", 2); // three partipants, which extra for fanout of 2, but not for 3.
  //multiLevel("three bots", 3);
});
      
