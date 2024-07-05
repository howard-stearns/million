import { makeResolvablePromise, delay } from '../utilities.mjs';
import { player, PlayerView } from '../player.mjs';
import { joinMillion, ComputationWorker, Computation } from '../demo-join.mjs';

jasmine.getEnv().configure({random: false});

describe("Million", function () {
  const forcer = Math.random(),
        timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL,
        testParameters = {
          artificialDelay: 0, // ms
          prepareInputs: './demo-prepare.mjs',
          join: './demo-join.mjs',
          compute: './demo-compute.mjs',
          collectResults: './demo-collect.mjs'
        },
        testViewParameters = {
          viewClass: ComputationWorker,
          //logger: './console-logger.mjs',
          detachFromAncestors: true
        };
  beforeAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 45e3;
  })
  afterAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout;
  });
  let completedComputation;
  class Observer extends ComputationWorker {
    computationComplete(output) { // Resolve promise when we have the top-level answer.
      if (this.model.parentOptions) return;
      completedComputation.resolve(this);
    }
  }
  describe('player', function () {
    let session, promise = makeResolvablePromise(), viewCountPromise = makeResolvablePromise();
    class TestPlayer extends PlayerView {
      parametersSet(parameters) {
        promise.resolve(parameters);
      }
      viewCountChanged(viewCount) {
        viewCountPromise.resolve(viewCount);
      }
    }
    beforeAll(async function () {
      session = await player('playerTest' + forcer, {}, TestPlayer);
    });
    afterAll(async function () {
      promise = makeResolvablePromise();
      session.view.setParameters({test: null});
      let {test} = await promise;
      expect(test).toBe(null);
      await session.leave();
    });
    it('gets viewCount', async function () {
      expect(await viewCountPromise).toBe(1);
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
        session = await joinMillion({...sharedParameters, numberOfPartitions, fanout: answer}, testViewParameters);
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
    describe('decomposition', function () {
      it('rounds floating point log creep down, e.g, total 9 / fanout 3.', function () {
        expect(Computation.partitionCapacity(9, 3)).toBe(3);
      });
      it('does not round too much log creep, e.g, total 17 / fanout 4.', function () {
        expect(Computation.partitionCapacity(17, 4)).toBe(16);
      });
    });
    describe('three-level basic behavior', function () {
      let session, numberOfPartitions = 7, fanout = 2, answer = input * numberOfPartitions;
      beforeAll(async function () {
        completedComputation = makeResolvablePromise();
        session = await joinMillion({...sharedParameters, numberOfPartitions, fanout}, {...testViewParameters, viewClass: Observer});
        session.view.promiseOutput();
        const view = await completedComputation;
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
    class TestPlayerController extends PlayerView {
      async parametersSet({go, input, numberOfPartitions, fanout}) { // Deliverately not exactly the protocol of demo, as a unit test.
        if (!go) return;
        const computer = await joinMillion({
          input, numberOfPartitions, fanout,
          sessionName: 'millionTest' + forcer,
          ...testParameters
        }, testViewParameters),
              answer = await computer.view.promiseOutput();
        promise.resolve(answer);
      }
    }
    beforeAll(async function () {
      session = await player('playerTest' + forcer, {
        input: 1,
        numberOfPartitions: 4,
        fanout: 4
      }, TestPlayerController);
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
          botsReady = makeResolvablePromise(),
          nGroups = 10,
          nBotsPerGroup = 10,
          nBots = nGroups * nBotsPerGroup,
          numberOfPartitions = nBots,
          controllerName = 'botTestController' + forcer,
          sessionName = 'botTestComputation' + forcer, 
          parameters = {
            ...testParameters,
            sessionName: sessionName,
            input: 1,            
            artificialDelay: 1e3, // ms
            fanout: numberOfPartitions,
            numberOfPartitions
          };
      class BotController extends PlayerView {
        viewCountChanged(viewCount) { // When this player plus the lead bot are present, we may begin.
          if (viewCount >= 2) botsReady.resolve();
        }
      }
      beforeAll(async function () {
        let { execFile } = await import('node:child_process');
        completedComputation = makeResolvablePromise(),

        controller = await player(controllerName, {}, BotController); // Parameters must match those for controller used by bots.
        //console.log(`controller joined ${controllerName}/${controller.id} with ${controller.model.viewCount} present.`);
        observer = await joinMillion(parameters, {...testViewParameters, viewClass: Observer}); // Does not promiseOutput.
        bots = execFile('node', ['./bots.mjs', controllerName, nGroups, nBotsPerGroup]);
        //bots.stdout.on('data', data => console.log(`bot out: ${data}`));
        bots.stderr.on('data', data => console.log(`bot err: ${data}`));
        expect(observer.model.output).toBeUndefined();
        if (controller.model.viewCount < 2) { await botsReady; } // wait for lead bot
        //console.log(`Summoning bots to ${sessionName}`);
        controller.view.setParameters({sessionAction: 'joinOnly', ...parameters}); // But for testing, don't execute until all present.
        while (observer.model.viewCount < nBots) { // expect nBots + one observer
          console.log(`${sessionName} viewCount: ${observer.model.viewCount}`);
          await delay(1e3);
        }
        console.log(`Testing with ${observer.model.viewCount - 1} bots.`);
      });
      afterAll(async function () {
        await controller.leave();
        bots.kill();
      });
      it('computes answer.', async function () {
        controller.view.setParameters({sessionAction: 'compute'});
        await completedComputation;
        expect(observer.model.viewCount).toBeGreaterThan(nBots);
        expect(observer.model.output).toBe(numberOfPartitions);
      });
    });
  });
});
      
