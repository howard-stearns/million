import { Croquet, join } from './administrivia.mjs';
import { Computation, ComputationWorker } from './index.mjs';

export function joinMillion(options = {}) { // Join sessionName, returning a promise for the connected session.
  return join({
    name: options.sessionName,
    model: Computation,
    view: ComputationWorker,
    options
  });
}

