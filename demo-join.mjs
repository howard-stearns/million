import { Croquet, Computation, ComputationWorker } from './index.mjs';

export function joinMillion(sessionName, options = {}) { // Join sessionName, returning a promise for the connected session.
  // options will be used for initial setup.
  return Croquet.Session.join({
    appId: "com.ki1r0y.million",
    name: sessionName,
    apiKey: 'fake-key',
    password: "secret",
    model: Computation,
    view: ComputationWorker,
    options
  });
}
