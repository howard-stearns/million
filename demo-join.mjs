import { Croquet, join } from './administrivia.mjs';
import { Computation, ComputationWorker } from './index.mjs';
export { ComputationWorker };

export function joinMillion(options = {}, viewOptions = {viewClass: ComputationWorker}) { // Join sessionName, returning a promise for the connected session.
  return join({
    name: options.sessionName,
    model: Computation,
    view: viewOptions.viewClass,
    viewOptions,
    options
  });
}

