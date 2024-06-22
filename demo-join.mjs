import { requestAnimationFrame } from './utilities.mjs';
import { Croquet, Computation, ComputationWorker } from './index.mjs';
export { Croquet };

const sessions = [];
function step(time) { // Step all sessions in the same image at once. Makes debugging easier.
  let toRemove = [];
  sessions.forEach(session => {
    if (!session.view) toRemove.push(session); // session.leave() has occurred, and the view detached.
    else session.step(time);
  })
  toRemove.forEach(session => sessions.splice(sessions.find(session), 1));
  requestAnimationFrame(step);
};

export async function joinMillion(options = {}) { // Join sessionName, returning a promise for the connected session.
  const session = await Croquet.Session.join({
    appId: 'com.gmail.howard.stearns.microverse',
    name: options.sessionName,
    apiKey: '17GxHzdAvd4INCAHfJoDm39LH6FkmkLa5qdLhGLqA',
    password: "secret",
    model: Computation,
    view: ComputationWorker,
    step: "manual", // Must be manual for NodeJS Croquet. This same code works in both.
    options  // Used for initial setup.
  });
  requestAnimationFrame(step);
  return session;
}
