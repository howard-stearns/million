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

  There are limits to how many participants can be connected simultaneously. If that isn't enough for the number of partitions, the calculation
  is recursively partitioned such that each task is handled by another session.
*/
export const { Croquet } = (typeof window !== 'undefined') ? window : await import('@kilroy-code/croquet-in-memory/index.mjs');

function makeResolvablePromise() { // Return a promise with a 'resolve' property.
  let resolver, promise = new Promise(resolve => resolver = resolve);
  promise.resolve = resolver;
  return promise;
}

export class Computation extends Croquet.Model { // The abstract persistent state of the computation.
  init(parameters) {
    super.init(parameters);
    Object.assign(this, parameters);
    this.originalOptions = parameters; // So that bots can use the same options.
    let {numberOfPartitions, fanout} = parameters,
        length; // Either number of computations, or sub-partitions for further fanout.
    if (numberOfPartitions <= fanout) { // We are the last level. Just do the computation.
      length = numberOfPartitions;
    } else {                            // We are an interior node, with at least one level below us.
      length = fanout;
      const logBaseFanout = Math.log(numberOfPartitions) / Math.log(length),
            cleanerLog = Math.round(10 * logBaseFanout) / 10, // logBaseFanout sometimes creeps above the integer, so round to nearest 10
            remainingLevels = this.remainingLevels = Math.ceil(cleanerLog) - 1,
            maxSubCapacity = Math.pow(length, remainingLevels),
            parts = this.interiorPartitions = Array(length).fill(0); // If not filled, reduce won't iterate.
      parts.reduce((previousTotal, _, index) => { // Fill parts with the number of partitions needed at each index.
        let nextTotal = Math.min(previousTotal + maxSubCapacity, numberOfPartitions);
        parts[index] = nextTotal - previousTotal;
        return nextTotal;
      }, 0);
    }
    this.outputs = Array(length);
    this.completed = Array(length).fill(false);
    this.inProgress = Array.from({length}, () => new Set()); // Each element gets its own, unshared value.
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
    const workers = this.inProgress[index]; // Can be null if that partition never got started.
    return workers?.delete(viewId);
  }
  endPartition({viewId, index, output}) { // Update the accounting for that partition and tell the viewId the next partition.
    this.removeWorker(viewId, index);
    this.completed[index] = true;
    this.outputs[index] = output;
    this.future(50).startNextPartition(viewId); // Next tick to see if others finish before telling view to do more work. Easier debugging.
  }
  viewExit(viewId) { // Remove the partipant from the list of workers inProgress so that someone else will pick it up.
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
  setInputs(inputs) { return this.setModel('setInputs', inputs); } // promise to set in model.
  setBots(nBots) { return this.setModel('setBots', nBots); }  
  setOutput(output) { return this.setModel('setOutput', output); }
  trace(label, startTime, ...data) {  // Conditionally log with ms since startTime
    const now = Date.now();
    this.logger?.(this.model.originalOptions.sessionName, this.viewId, label, ...data, (startTime ? now - startTime : ''));
    return now;
  }
  async promiseLogger() { this.logger ||= this.model.logger && (await import(this.model.logger)).log; }

  async promiseInputs() { // Answer a promise to ensure that this.model.inputs is assigned with the inputs for each partition.
    await this.promiseLogger(); // Before checking model values, as it needs to happen in each participant.
    if (this.model.inputs) return;
    const start = this.trace('preparing inputs'),
          { prepareInputs } = await import(this.model.prepareInputs),
          inputs = await prepareInputs(this.model.input, this.model.outputs.length); // outputs is the adjusted length for this node.
    this.trace('prepared inputs', start, inputs.length);
    await this.setInputs(inputs);
  }
  async promiseBots() { // Answer a promise to ensure that this.model.bots is assigned with the number of bots launched
    // The bots will work the partitions of THIS level, which might mean either joining a next-level session and acting as
    // a bridge to it, or doing the computation (if there is no next level down).
    if (this.model.bots !== undefined) return;
    await this.promiseInputs();
    if (!this.model.launchBots || !this.model.requestedNumberOfBots) return await this.setBots(0);
    await this.setBots(0); // Don't let anyone launch bots while we are.
    const start = this.trace('launching bots'),
          { launchBots } = await import(this.model.launchBots),
          // Since these bots are for working THIS level, they use the same parameters as this first instance.
          // (But once they are connected to this session, this.model.bots will bet set so that THEY don't make more.
          requesting = Math.min(this.model.requestedNumberOfBots, this.model.numberOfPartitions),
          nBots = await launchBots(this.model.originalOptions, requesting);
    this.trace('bots', start, nBots);
    await this.setBots(nBots);
  }
  partitionToWork(index) {
    // let element = document?.getElementById(this.model.originalOptions.sessionName);
    // if (element) {
    //   let progress = this.model.inProgress.map(part => part.size);
    //   element.textContent = progress;
    // }
    this.nextPartition?.resolve(index);
  }
  async compute1(input, index) { // Promise the output of the computation of just one partition.
    const { compute } = await import(this.model.compute); // Browser will cache.
    return compute(input, index);
  }
  async coordinateNextLevel(input, index) { // Promise the output of another session representing this partion to be further devided
    const { joinMillion } = await import(this.model.join),
          subName = `${this.model.originalOptions.sessionName}-${index}`, // The reproducible "address" of the next node down in this problem.
          subOptions = this.newOptions({ // Reduce the problem a bit.
            sessionName: subName,
            numberOfPartitions: this.model.interiorPartitions[index],
          }),
          session = await joinMillion(subOptions),
          output = await session.view.promiseOutput(); // Waits for the whole total of partition and it's partitions.
    await session.leave();
    return output;  // The combined total of the next level.
  }
  async promiseComputation() { // Promise to work on the next available partition until all are complete.
    await this.promiseLogger(); // Again, for when bots => inputs have already been produced.
    await this.promiseBots();
    const viewId = this.viewId,
          label = this.model.interiorPartitions ? 'coordinate' : 'compute';
    this.nextPartition = makeResolvablePromise();
    this.publish(this.sessionId, 'startNextPartition', viewId);
    let index = await this.nextPartition;
    while (index >= 0) {
      const start = this.trace('start ' + label, null, index),
            input = this.model.inputs[index],
            output = (label === 'compute') ? await this.compute1(input, index) : await this.coordinateNextLevel(input, index);
      this.trace('finished ' + label, start, index, output);
      this.nextPartition = makeResolvablePromise();
      this.publish(this.sessionId, 'endPartition', {viewId, index, output});
      index = await this.nextPartition;
    } 
  }
  async promiseOutput() { // Answer a promise to ensure that this.model.output is assigned with the collected results, returning output.
    await this.promiseComputation();
    if (this.model.output !== undefined) return this.model.output; // For convenience, returns output.
    const start = Date.now(),
          { collectResults } = await import(this.model.collectResults),
          output = await collectResults(this.model.outputs),
          elapsed = Date.now() - start;
    this.trace('output', start, output);
    await this.setOutput(output);
    return output;
  }
  newOptions(parameters) {
    return Object.assign({}, this.model.originalOptions, parameters);
  }
}
