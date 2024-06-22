export function log(...data) { // Called from the machinery. Can be no-op, or report to somewhere.
  if (data[2].startsWith('start co')) data.splice(4, 1);  // The model arg in this case is overkill. It's there for browser tracing.
  console.log(...data);
}
