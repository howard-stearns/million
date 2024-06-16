export function log(...data) { // Called from the machinery. Can be no-op, or report to somewhere.
  //if (data[2] !== 'coordinate') return;
  console.log(...data);
}
