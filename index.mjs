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
import { Croquet, makeResolvablePromise } from './utilities.mjs';
const SUSPENDED = 'suspended';

export class Computation extends Croquet.Model { // The abstract persistent state of the computation.
  init(parameters) {
    super.init(parameters);
    Object.assign(this, parameters);
    this.originalOptions = parameters; // separate from parentOptions, and used by newOptions.
    let {numberOfPartitions, fanout} = parameters,
        length; // Either number of computations, or sub-partitions for further fanout.
    if (numberOfPartitions <= fanout) { // We are the last level. Just do the computation.
      length = numberOfPartitions;
    } else {                            // We are an interior node, with at least one level below us.
      length = fanout;
      this.partitionCapacity = this.constructor.partitionCapacity(numberOfPartitions, fanout);
    }
    this.outputs = Array(length);
    this.completed = Array(length).fill(false);
    this.inProgress = Array.from({length}, () => new Set()); // Each element gets its own, unshared value.
    this.subscribe(this.sessionId, 'view-exit', this.viewExit);
    this.subscribe(this.sessionId, 'setInputs', this.setInputs);
    this.subscribe(this.sessionId, 'setPartitionOutput', this.setPartitionOutput);
    this.subscribe(this.sessionId, 'setOutput', this.setOutput);
    this.subscribe(this.sessionId, 'startNextPartition', this.startNextPartition);
    this.subscribe(this.sessionId, 'endPartition', this.endPartition);
  }
  static partitionCapacity(total, fanout) { // How many partitions can fit in each index.
    const logBaseFanout = Math.log(total) / Math.log(fanout),
          toNearest = 1000,
          cleanerLog = Math.max(0.1, Math.round(toNearest * logBaseFanout) / toNearest), // logBaseFanout sometimes creeps above the integer, so round to nearest 10
          levels = Math.ceil(cleanerLog) - 1;
    return Math.pow(fanout, levels)
  }
  static numberAtIndex(total, partitionCapacity, index) { // How many sub partitions are in the indexth partition of the next level?
    return Math.max(0, Math.min(partitionCapacity, total - (partitionCapacity * index)));
  }

  setInputs([requestId, inputs]) { // Set Inputs and tell everyone of the update.
    this.inputs = inputs;
    this.publish(this.sessionId, 'modelConfirmation', requestId);
  }
  setOutput([requestId, output]) { // Set Inputs and tell everyone of the update.
    this.output = output;
    this.publish(this.sessionId, 'modelConfirmation', requestId);
    this.publish(this.sessionId, 'computationComplete', output);
  }
  // There are three state properties associated with the calculation of partition results:
  // - outputs is an array of the result of each corresponding partition
  // - complete is array of which elements are complete
  // - inProgress is an array of which each element is a Set of the viewId of the workers currently computing that partition's result.
  //   It's ok to have multiple workers on a partition because they might drop out before their work is done.
  //   We keep track of the viewId so that we can remove that worker when we get view-exit event.
  //   The size of the set for a partition gives the number of current workers on that partition.
  //   We put new workers into the first partition that has the least number of workers. 
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
  setPartitionOutput({index, output}) {
    this.completed[index] = true;
    this.outputs[index] = output;
  }
  endPartition({viewId, index, output}) { // Update the accounting for that partition and tell the viewId the next partition.
    this.removeWorker(viewId, index);
    this.setPartitionOutput({index, output});
    this.startNextPartition(viewId); // Next tick to see if others finish before telling view to do more work. Easier debugging.
  }
  viewExit(viewId) { // Remove the partipant from the list of workers inProgress so that someone else will pick it up.
    for (let index = 0; index < this.inProgress.length; index++) {
      if (this.removeWorker(viewId, index)) return;
    }
  }
}
Computation.register(Computation.name);

export class ComputationWorker extends Croquet.View { // Works on whatever part of the computation neeeds doing.
  constructor(model, viewOptions) {
    super(model);
    this.model = model;
    this.viewOptions = viewOptions;
    this.nextRequestId = 0;
    this.requests = {};
    this.subscribe(this.sessionId, 'modelConfirmation', this.modelConfirmation);
    this.subscribe(this.viewId, 'partitionToWork', this.partitionToWork);
    this.subscribe(this.sessionId, 'computationComplete', this.computationComplete);
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
  setOutput(output) { return this.setModel('setOutput', output); }
  async trace(label, startTime, ...data) {  // Conditionally log with ms since startTime
    const logger = await this.promiseLogger();
    if (!logger) return;
    const now = Date.now(),
          name = this.model.sessionName ,
          leadSpace = Array.from(name).map(c => c === '-' ? '   ' : '').join('');
    logger(leadSpace, name, this.viewId + (this.session ? '' : '-DEAD'), label, ...data, (startTime ? now - startTime : ''));
    return now;
  }
  // Browser will cache these results, but bots might not.
  async promiseLogger() { return this.logger ||= this.viewOptions.logger && (await import(this.viewOptions.logger)).log; }
  promiseCompute() { return this.constructor.compute ||= import(this.model.compute); }
  promisePrepare() { return this.constructor.prepare ||= import(this.model.prepareInputs); }
  promiseJoin() { return this.constructor.join ||= import(this.model.join); }
  promiseCollect() { return this.constructor.collect ||= import(this.model.collectResults); }
  promiseCode() { return Promise.all([this.promiseLogger(), this.promiseJoin(), this.promisePrepare(), this.promiseCompute(), this.promiseCollect()]); }
  

  async promiseInputs() { // Answer a promise to ensure that this.model.inputs is assigned with the inputs for each partition.
    if (this.model.inputs) return this.model.inputs;
    const start = await this.trace('preparing inputs'),
          { prepareInputs } = await this.promisePrepare(),
          inputs = await prepareInputs(this.model.input, this.model.outputs.length, this.model.arificialDelay); // outputs is the adjusted length for this node.
    this.trace('prepared inputs', start, inputs.length);
    await this.setInputs(inputs);
    return inputs;
  }
  partitionToWork(index) {
    this.nextPartition?.resolve(index);
  }
  async compute1(input, index) { // Promise the output of the computation of just one partition.
    const { compute } = await this.promiseCompute();
    return compute(input, index, this.model.artificialDelay);
  }
  async join1(options) {
    const {sessionName} = options,
          start = await this.trace('join', null, sessionName),
          { joinMillion } = await this.promiseJoin(),
          session = await joinMillion(options, this.viewOptions);
    this.trace('joined', start, sessionName);
    return session;
  }
  async coordinateNextLevel(input, index) { // Promise the output of another session representing this partion to be further devided
    if (this.viewOptions.detachFromAncestors) {
      this.trace('leaving to coordinate child', null, index);
      await this.session?.leave();
    }
    const subName = `${this.model.sessionName}-${index}`, // The reproducible "address" of the next node down in this problem.
          subOptions = this.newOptions({ // Reduce the problem a bit.
            sessionName: subName,
            numberOfPartitions: this.model.constructor.numberAtIndex(this.model.numberOfPartitions, this.model.partitionCapacity, index),
          }),
          session = await this.join1(subOptions),
          output = await session.view.promiseOutput(); // Waits for the whole total of partition and it's partitions.
    await session.leave();
    if (output === SUSPENDED) return output; // We have detached, and so has what we were working on. Indicate so to callers.
    if (this.session) return output; // Normal flow
    // We have detached. Pick things up again.
    // When we leave an upper session to do the work of a lower session,  this code, and the promiseUpward it calls, is how
    // we get back into the upper session and continue working.
    const upsession = await this.join1(this.model.originalOptions);
    upsession.view.promiseUpward(index, output); // Don't await. Just let it happen
    return SUSPENDED;
  }
  async promiseComputation() { // Promise to work on the next available partition until all are complete.
    await this.promiseInputs();
    const viewId = this.viewId,
          label = this.model.partitionCapacity ? 'coordinating' : 'computing';
    this.nextPartition = makeResolvablePromise();
    this.publish(this.sessionId, 'startNextPartition', viewId);
    let index = await this.nextPartition;
    while (index >= 0) {
      const start = await this.trace('start ' + label, null, index, this.model),
            input = this.model.inputs[index],
            output = (label === 'computing') ? await this.compute1(input, index) : await this.coordinateNextLevel(input, index);
      this.nextPartition = makeResolvablePromise();
      this.publish(this.sessionId, 'endPartition', {viewId, index, output});
      index = await this.nextPartition;
      this.trace('finished ' + label, start, index, output);
    }
    return this.model.outputs;
  }
  async promiseOutput() { // Answer a promise to ensure that this.model.output is assigned with the collected results, returning output.
    const startAll = await this.trace('start round');
    await this.promiseComputation();
    if (this.model.output !== undefined) {
      this.setOutput(this.model.output);
      return this.model.output; // For convenience, returns output.
    }
    const start = await this.trace('collect output', null),
          { collectResults } = await this.promiseCollect(),
          output = await collectResults(this.model.outputs, this.model.artificialDelay);
    this.trace('collected output', start, output);
    await this.setOutput(output);
    this.trace('end round', startAll);
    return output;
  }
  async promiseUpward(index, output) { // Promise to enter output result and index and continue computaiton in ancestors. See comments at caller.
    let start = await this.trace('promiseUpward', null, index, output);
    this.setPartitionOutput(index, output);
    const parentOutput = await this.promiseOutput();
    // If we get this far (promiseOutput returns), it is time to go up another level.
    this.trace('computed output for restarted parent', start, parentOutput);
    this.setOutput(parentOutput);
    const grandparentOptions = this.model.parentOptions;
    if (!grandparentOptions) {
      return this.computationComplete(parentOutput);
    }
    await this.session.leave();
    const parentIndex = this.indexInParent(),
          grandparent = await this.join1(grandparentOptions);
    grandparent.view.promiseUpward(parentIndex, parentOutput);
  }
  indexInParent() { // Answer this coordinating session's index within parent
    return parseInt(this.model.originalOptions.sessionName.slice(this.model.parentOptions.sessionName.length + 1))
  }
  newOptions(parameters) { // Combine new parameters with original, and answer a set of options suitable for a coordinating child session.
    let {originalOptions} = this.model;
    return Object.assign({}, originalOptions, parameters, {parentOptions: originalOptions});
  }
  setPartitionOutput(index, output) { // Let everyone know about our answer.
    this.publish(this.sessionId, 'setPartitionOutput', {index, output});
  }
  computationComplete(output) { } // Subclass to learn of this happening.
}
