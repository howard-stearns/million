import { Croquet, join } from './administrivia.mjs';
import { Computation, ComputationWorker } from './index.mjs';
export { Computation, ComputationWorker, Croquet };

const defaultViewOptions = {
  detachFromAncestors: true,  // When coordinating leaves, do not stay connected to ancestor coordinators.
  viewClass: ComputationWorker
};

export function joinMillion(options = {}, viewOptions = defaultViewOptions) { // Join sessionName, returning a promise for the connected session.
  return join({
    name: options.sessionName,
    model: Computation,
    view: viewOptions.viewClass,
    viewOptions,
    options
  });
}

