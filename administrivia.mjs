import { Croquet, requestAnimationFrame, serializePromises, delay } from './utilities.mjs';
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

async function join1(parameters) {
  const session = await Croquet.Session.join({

    step: stepType, 

    ...administrivia,
    ...parameters,
  }).catch(async error => {
    console.error(`**** got failure ${error.message} ****`);
    await delay(100 + Math.random() * 400);
    return Croquet.Session.join({step: stepType, ...administrivia, ...parameters});
  });
  sessions.push(session);
  if (stepType === 'manual') requestAnimationFrame(session.step);
  return session;
}

// When the same Javascript thread fires too many overlapping Croquet.Session.join request,
// it can get connection timeouts (either at the reflector or at the api key validation).
// Here we serialize them to occur one at time. That's helpful when there are several bots
// in the same Javascript, and doesn't effect things otherwise.
export const join = serializePromises(join1);

