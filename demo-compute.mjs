function delay(ms) { // Promise to resolve after the specified milliseconds.
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function compute(input, paritionIndex) {
  // Compute the nth part of the computation. input is the previously prepared input for this partition.
  // - Must be asynchronous (or return a Promise) that resolves to the partition result when ready.
  // - This computation will be repeated on as many nodes as needed to produce the combined result,
  //   typically with a different partitionIndex and input. However, if there is a surplus of available
  //   worker nodes, several may be asked to work on the same partition in case any drop out. If there
  //   is not a surplus of nodes, the same node may be asked to compute multiple partitions, one partition
  //   at a time.
  await delay(1e3); // Simulate some working time.
  return input; // The collection will be given an array of these results.
}
