import { Croquet, Computation, ComputationWorker } from './index.mjs';
export { Croquet };

export async function joinMillion(options = {}) { // Join sessionName, returning a promise for the connected session.
  const session = await Croquet.Session.join({
    appId: 'com.gmail.howard.stearns.microverse',
    name: options.sessionName,
    apiKey: '17GxHzdAvd4INCAHfJoDm39LH6FkmkLa5qdLhGLqA',
    password: "secret",
    model: Computation,
    view: ComputationWorker,
    options  // Used for initial setup.
  });
  //console.log('joined', {name: options.sessionName, options, persistent: session.persistentId, version: session.versionId});
  return session;
}
