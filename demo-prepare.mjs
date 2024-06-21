import { delay } from './utilities.mjs';

export async function prepareInputs(problemInput, numberOfPartitions, artificialDelay) {
  // Return an array of inputs where each element is the input for the computation of the corresponding partition.
  // - Even if each computation doesn't use the input, you must still answer an array of the correct length.
  // - Must be asynchronous (or return a Promise) that resolves to the array when ready.
  // - The preparation of inputs itself is not distributed over many nodes, but the distributed computation
  //   can do partitioned prep work.
  await delay(artificialDelay); // Simulate some working time.  
  return Array(numberOfPartitions).fill(problemInput);
}
