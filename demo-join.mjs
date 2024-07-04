import { Croquet, join } from './administrivia.mjs';
import { Computation, ComputationWorker } from './index.mjs';
export { ComputationWorker };

export async function joinMillion(options = {}, viewOptions = {
  detachFromAncestors: true,  // When coordinating leaves, do not stay connected to ancestor coordinators.
  viewClass: ComputationWorker
}) { // Join sessionName, returning a promise for the connected session.
  //console.log(JSON.stringify(options, null, 2));
  const session = await join({
    name: options.sessionName,
    model: Computation,
    view: viewOptions.viewClass,
    viewOptions,
    options
  }),
        {persistentId, versionId, id} = session;
  //console.log({persistentId, versionId, id});
  return session;
}

