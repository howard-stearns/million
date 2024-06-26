import { makeResolvablePromise, delay } from '../utilities.mjs';
import { player } from '../player.mjs';
import { joinMillion } from '../demo-join.mjs';
import { ComputationWorker } from '../index.mjs';

jasmine.getEnv().configure({random: false});

describe("Million", function () {
  const forcer = Math.random(),
        timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL,
        testParameters = {
          artificialDelay: 0, // ms
          //logger: './console-logger.mjs',
          prepareInputs: './demo-prepare.mjs',
          join: './demo-join.mjs',
          compute: './demo-compute.mjs',
          collectResults: './demo-collect.mjs'
        };
  beforeAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 45e3;
  })
  afterAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout;
  });
  describe('player', function () {
    let session, promise = makeResolvablePromise();
    beforeAll(async function () {
      session = await player('playerTest' + forcer, {}, parameters => promise.resolve(parameters));
    });
    afterAll(async function () {
      promise = makeResolvablePromise();
      session.view.setParameters({test: null});
      let {test} = await promise;
      expect(test).toBe(null);
      await session.leave();
    });
    it('gets updates.', async function () {
      session.view.setParameters({test: 3});
      let {test} = await promise;
      expect(test).toBe(3);
    });
  });
  describe('single participant computation', function () {
    const input = 2,
          sharedParameters = {
            sessionName: 'millionTest' + forcer,          
            input,
            ...testParameters
          };
    describe('single-level basic behavior', function () {
      let session, numberOfPartitions = 7, answer = input * numberOfPartitions; // In this case.
      beforeAll(async function () {
        session = await joinMillion({...sharedParameters, numberOfPartitions, fanout: answer});
      });
      afterAll(async function () {
        await session.leave();
      });
      it('prepares inputs.', async function () {
        let inputs = await session.view.promiseInputs();
        expect(inputs.length).toBe(numberOfPartitions);
        expect(inputs.every(element => element === input)).toBeTruthy();
      });
      it('had no interiorPartitions for a next level (in this case).', function () {
        expect(session.model.interiorPartitions).toBeFalsy();
      });
      it('fills outputs.', async function () {
        let outputs = await session.view.promiseComputation();
        expect(outputs.length).toBe(numberOfPartitions);
        expect(outputs.every(element => element === input)).toBeTruthy(); // In this case.
      });
      it('computes correct answer.', async function () {
        expect(await session.view.promiseOutput()).toBe(answer);
      });
    });
    describe('three-level basic behavior', function () {
      let session, numberOfPartitions = 7, fanout = 2, answer = input * numberOfPartitions;
      beforeAll(async function () {
        session = await joinMillion({...sharedParameters, numberOfPartitions, fanout});
        const promise = new Promise(resolve => ComputationWorker.oncomplete = resolve);
        session.view.promiseOutput();
        const view = await promise;
        session = view.session;
      });
      afterAll(async function () {
        await session.leave();
      });
      it('prepares inputs.', async function () {
        let inputs = await session.view.promiseInputs();
        expect(inputs.length).toBefanout;
        expect(inputs.every(element => element === input)).toBeTruthy();
      });
      it('had interiorPartitions for a next level (in this case).', function () {
        expect(session.model.interiorPartitions).toBeTruthy();
      });
      it('fills outputs.', async function () {
        let outputs = await session.view.promiseComputation(),
            completed = session.model.completed;
        expect(outputs.length).toBe(fanout);
        expect(outputs[0]).toBe(input * fanout * fanout);
        expect(outputs[1]).toBe(input * (fanout * fanout - 1)); // In this case
        expect(completed.length).toBe(fanout);
        expect(completed.every(element => element)).toBeTruthy();
      });
      it('computes correct answer.', async function () {
        expect(await session.view.promiseOutput()).toBe(answer);
      });
    });
  });
  describe('player controls computation', function () {
    let session, promise = makeResolvablePromise();
    beforeAll(async function () {
      async function responder({go, input, numberOfPartitions, fanout}) {
        if (!go) return;
        const computer = await joinMillion({
          input, numberOfPartitions, fanout,
          sessionName: 'millionTest' + forcer,
          ...testParameters
        }),
              answer = await computer.view.promiseOutput();
        promise.resolve(answer);
      }
      session = await player('playerTest' + forcer, {
        input: 1,
        numberOfPartitions: 4,
        fanout: 4
      }, responder);
    });
    afterAll(async function () {
      await session.leave();
    });
    it('computes what it is told.', async function () {
      session.view.setParameters({go: true});
      let answer = await promise;
      expect(answer).toBe(4);
    });
  });
  describe('bots', function () {
    if (typeof(process) === 'undefined') {
      it('launching bots', function () { pending('cannot launch bots from browser'); });
      return;
    }

    describe('controlled by player', function () {
      let controller, observer, bots,
          nBots = 16,
          numberOfPartitions = nBots,
          controllerName = 'botTestController' + forcer,
          sessionName = 'botTestComputation' + forcer, 
          parameters = {
            ...testParameters,
            sessionName: sessionName,
            input: 1,            
            //logger: './console-logger.mjs',
            artificialDelay: 1e3, // ms
            fanout: numberOfPartitions,
            numberOfPartitions
          };
      beforeAll(async function () {
        let promise = makeResolvablePromise();
        let { execFile } = await import('node:child_process');

        function responder({viewCount = 0}) { if (viewCount >= 2) promise.resolve(); } // This player plus the lead bot = 2.
        controller = await player(controllerName, {}, responder); // Parameters must match those for controller used by bots.
        observer = await joinMillion(parameters); // Does not promiseOutput.
        bots = execFile('node', ['./bots.mjs', controllerName, nBots]);
        //bots.stdout.on('data', data => console.log(`bot out: ${data}`));
        bots.stderr.on('data', data => console.log(`bot err: ${data}`));
        expect(observer.model.output).toBeUndefined();
        console.log(`controller joined ${controllerName} with ${controller.model.viewCount} present.`);
        await promise; // bot lead has joined controller
        controller.view.setParameters({sessionAction: 'join', ...parameters}); // But for testing, don't execute until all present.
        while (observer.model.viewCount < nBots) { // expect nBots + one observer
          console.log(`${sessionName} viewCount: ${observer.model.viewCount}`);
          await delay(1e3);
        }
      });
      afterAll(async function () {
        await controller.leave();
        bots.kill();
      });
      it('computes answer.', async function () {
        console.log('start');
        controller.view.setParameters({sessionAction: 'compute'});
        console.log('parmeters set');
        await new Promise(resolve => observer.view.oncomplete = resolve);
        // Fragile. responder() knows when the lead bot arrives in player, but after commanding everyone to join
        // the computation, we don't actually know when they have all arrived. It is possible for the computation to
        // complete before they all finish joining.
        console.log(`Number of participants: ${observer.model.viewCount}.`);
        expect(observer.model.viewCount).toBeGreaterThan(Math.min(nBots, 20));
        expect(observer.model.output).toBe(numberOfPartitions);
      });
    });
  });
});
      
