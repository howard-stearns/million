import { Croquet, Computation, ComputationWorker } from './index.mjs';

export function joinMillion(options = {}) { // Join sessionName, returning a promise for the connected session.
  return Croquet.Session.join({
    appId: "com.ki1r0y.million",
    name: options.sessionName,
    apiKey: 'fake-key',
    password: "secret",
    model: Computation,
    view: ComputationWorker,
    options  // Used for initial setup.
  });
}
