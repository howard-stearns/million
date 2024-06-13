export async function collectResults(outputs) {
  // Collect the final value from the array of partition results.
  // - Must be asynchronous (or return a Promise) that resolves to the combined result when ready.
  // - The collection itself is not distributed over many nodes, but the distributed computation
  //   can do combining work such that the collection is basically a no-op.
  return outputs.reduce((accum, value, n) => accum + value, 0);
}
