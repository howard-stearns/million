import { Croquet, requestAnimationFrame } from './utilities.mjs';
export { Croquet };

export const administrivia = {
  appId: 'com.gmail.howard.stearns.microverse',
  apiKey: '17GxHzdAvd4INCAHfJoDm39LH6FkmkLa5qdLhGLqA',
  password: "secret"
};

const sessions = [];
function step(time) { // Step all sessions in the same image at once. Makes debugging easier.
  if (!sessions.length) return;
  let toRemove = [];
  sessions.forEach(session => {
    if (!session.view) toRemove.push(session); // session.leave() has occurred, and the view detached.
    else session.step(time);
  })
  toRemove.forEach(session => {
    const index = sessions.indexOf(session);
    sessions.splice(index, 1);
  });
  requestAnimationFrame(step);
};

// Must be manual for NodeJS Croquet. This same code works in both.
const stepType = (typeof(process) === 'undefined') ? 'auto' : 'manual';

export async function join(parameters) {
  const session = await Croquet.Session.join({

    step: stepType, 

    ...administrivia,
    ...parameters,
  });
  sessions.push(session);
  requestAnimationFrame(step);
  return session;
}



