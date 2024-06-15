import { joinMillion } from '../demo-join.mjs';


describe("Million", function () {
  let timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  beforeAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 45e3;
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
              //logger: './demo-logger.mjs',
              prepareInputs: './demo-prepare.mjs',
              join: './demo-join.mjs',
              launchBots: './node-bots.mjs',
              compute: './demo-compute.mjs',
              collectResults: './demo-collect.mjs'
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
      bakersDozen(`fanout 12,`, 12, requestedNumberOfBots);
      bakersDozen(`fanout 4,`, 4, requestedNumberOfBots);      
      bakersDozen(`fanout 3,`, 3, requestedNumberOfBots);      
      bakersDozen(`fanout 2,`, 2, requestedNumberOfBots);      
    });
  }
  //test1("x", 12, 2, 0);
  //multiLevel("no bots,", 0); // 330 seconds
  //multiLevel("one bot,", 1); // 260 seconds
  multiLevel("three bots,", 3); // 237 seconds
});
      
