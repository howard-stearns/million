/*
  Each session represents an ongoing permanent record of a partitionable computation, and has a guid identifier.
  When the calculation is complete, it has:
  - a list of inputs to each partition
  - a list of outputs from each partition
  - the combiled result

  Until then, it will have a portion of these, as well as operational information such as what participants are connected and what they are working on.
  Participants may come and go -- even going to zero participants -- but the session persists forever.

  When a participant joins, it does whatever work is needed next - computing the inputs for all, or computing the output of the next unhandled partition, etc.
  After that, it will pick up the next piece. Thus one partipant can do all the work if you wait long enough.
  If all tasks are assigned, a new partipant will double up on a task. This is fine: any partipant might drop out, and the first successful result
  will be recorded. (It would also be possible to compare results, but that is not implemented yet.)

  There are limits to how many participants can be connected simultaneously. If that isn't enough for the number of paritions, the calculation
  is recursively partitioned such that each task is handled by another session.
*/
import { Croquet } from '@kilroy-code/croquet-in-memory/index.mjs';
export { Croquet };

function makeResolvablePromise() {
  let resolver, promise = new Promise(resolve => resolver = resolve);
  promise.resolve = resolver;
  return promise;
}

export class Computation extends Croquet.Model { // The abstract persistent state of the computation.
  init(parameters) {
    super.init(parameters);
    Object.assign(this, parameters);
    this.originalOptions = parameters; // So that bots can use the same options.
    this.outputs = Array(parameters.fanout);
    this.completed = Array(parameters.fanout).fill(false);
    this.inProgress = Array.from({length: parameters.fanout}, () => new Set()); // Each element gets its own, unshared value.
    this.subscribe(this.sessionId, 'view-exit', this.viewExit);
    this.subscribe(this.sessionId, 'setInputs', this.setInputs);
    this.subscribe(this.sessionId, 'setBots', this.setBots);    
    this.subscribe(this.sessionId, 'setOutput', this.setOutput);
    this.subscribe(this.sessionId, 'startNextPartition', this.startNextPartition);
    this.subscribe(this.sessionId, 'endPartition', this.endPartition);
  }
  setInputs([requestId, inputs]) { // Set Inputs and tell everyone of the update.
    this.inputs = inputs;
    this.publish(this.sessionId, 'modelConfirmation', requestId);
  }
  setOutput([requestId, output]) { // Set Inputs and tell everyone of the update.
    this.output = output;
    this.publish(this.sessionId, 'modelConfirmation', requestId);
  }
  setBots([requestId, launched]) { // Set the number of bots that have been launched (if any) and tell everyone of the update.
    this.bots = launched;
    this.publish(this.sessionId, 'modelConfirmation', requestId);
  }
  // There are three state properties associated with the calculation of partition results:
  // - outputs is an array of the result of each corresponding partition
  // - complete is array of which elements are complete
  // - inProgress is an array of which each element is a list of the viewId of the workers currently computing that partition's result.
  //   It's ok to have multiple workers on a partition because they might drop out before their work is done.
  //   We keep track of the viewId so that we can remove that worker when we get view-exit event.
  //   The length of the list in an element gives the number of current workers on that partition.
  //   We put new bots into the first partition that has the least number of workers. 
  startNextPartition(viewId) { // Find the next partition index to work, update the accounting for that partition, and tell viewId the partition index.
    const {completed, inProgress} = this;
    if (completed.every(element => element)) this.publish(viewId, 'partitionToWork', -1);
    function fewer(fewest, worklist, index) {
      const nWorkers = completed[index] ? Number.MAX_SAFE_INTEGER : worklist.size;
      return Math.min(fewest, nWorkers);
    }
    const fewestWorkers = inProgress.reduce(fewer, Number.MAX_SAFE_INTEGER),
          index = this.inProgress.findIndex((worklist, index) => !completed[index] && (worklist.size === fewestWorkers));
    if (index >= 0) { // In case something goes bonkers.
      this.inProgress[index].add(viewId);
    }
    this.publish(viewId, 'partitionToWork', index);
  }
  removeWorker(viewId, index) { //  Update the accounting for a worker that has stopped working on their partition.
    const workers = this.inProgress[index];
    return workers.delete(viewId);
  }
  endPartition({viewId, index, output}) { // Update the accounting for that parition and tell the viewId the next parition.
    this.removeWorker(viewId, index);
    this.completed[index] = true;
    this.outputs[index] = output;
    this.startNextPartition(viewId);
  }
  viewExit(viewId) {
    for (let index = 0; index < this.inProgress.length; index++) {
      if (this.removeWorker(viewId, index)) return;
    }
  }
}
Computation.register(Computation.name);

export class ComputationWorker extends Croquet.View { // Works on whatever part of the computation neeeds doing.
  constructor(model) {
    super(model);
    this.model = model;
    this.nextRequestId = 0;
    this.requests = {};
    this.subscribe(this.sessionId, 'modelConfirmation', this.modelConfirmation);
    this.subscribe(this.viewId, 'partitionToWork', this.partitionToWork);
  }

  // We do not write directly to the Computation model. Instead, we publish an event that gets reflected back to all
  // the partipants. When it comes back to us, our copy of the Computation model object will have the value set.
  async setModel(event, ...parameters) { // Promise to set a value in the shared model and resolve when our model has updated with the new value.
    const requestId = this.nextRequestId++;
    return new Promise(resolve => {
      this.requests[requestId] = resolve;
      this.publish(this.sessionId, event, [requestId, ...parameters]);
    });
  }
  async modelConfirmation(requestId) { // An event that someone (maybe not us) has set something in the model, using the specified requestId;
    const confirmation = this.requests[requestId]; // If it is ours, we will resolve the promise that was awaiting confirmation.
    if (!confirmation) return;
    delete this.requests[requestId];
    confirmation();
  }
  setInputs(inputs) { return this.setModel('setInputs', inputs); }
  setBots(nBots) { return this.setModel('setBots', nBots); }  
  setOutput(output) { return this.setModel('setOutput', output); }
  startPartition(index) { return this.setModel('startPartition', index); }
  endPartition(index, result) { return this.setModel('endPartition', index, result); }

  async promiseInputs() { // Answer a promise to ensure that this.model.inputs is assigned with the inputs for each partition.
    if (this.model.inputs) return;
    const start = Date.now(),
          { prepareInputs } = await import(this.model.prepareInputs),
          inputs = await prepareInputs(this.model.input, this.model.fanout),
          elapsed = Date.now() - start;
    console.log(elapsed, 'inputs', this.viewId, inputs);
    await this.setInputs(inputs);
  }
  async promiseBots() { // Answer a promise to ensure that this.model.bots is assigned with the number of bots launched
    if (this.model.bots !== undefined) return;
    await this.promiseInputs();
    if (!this.model.launchBots || !this.model.requestedNumberOfBots) return await this.setBots(0);
    await this.setBots(0); // Don't let anyone launch bots while we are.
    const start = Date.now(),
          { launchBots } = await import(this.model.launchBots),
          nBots = await launchBots(this.model.sessionName, this.model.originalOptions, this.model.requestedNumberOfBots),
          elapsed = Date.now() - start;
    console.log(elapsed, 'bots', this.viewId, nBots);
    await this.setBots(nBots);
  }
  partitionToWork(index) {
    this.nextPartition?.resolve(index);
  }
  async promiseComputation() { // Promise to work on the next available parition until all are complete.
    await this.promiseBots();
    const viewId = this.viewId;
    this.nextPartition = makeResolvablePromise();
    this.publish(this.sessionId, 'startNextPartition', viewId);
    let index = await this.nextPartition;
    while (index >= 0) {
      const start = Date.now(),
            { compute } = await import(this.model.compute), // Browser will cache.
            input = this.model.inputs[index],
            output = await compute(input, index),
            elapsed = Date.now() - start;
      console.log(elapsed, 'computation', viewId, 'index', index, output);
      this.nextPartition = makeResolvablePromise();
      this.publish(this.sessionId, 'endPartition', {viewId, index, output});
      index = await this.nextPartition;
    } 
  }
  async promiseOutput() { // Answer a promise to ensure that this.model.output is assigned with the collected results, returning output.
    if (this.model.output !== undefined) return;
    await this.promiseComputation();
    const start = Date.now(),
          { collectResults } = await import(this.model.collectResults),
          output = await collectResults(this.model.outputs),
          elapsed = Date.now() - start;
    console.log(elapsed, 'output', this.viewId, output);
    await this.setOutput(output);
  }
}

