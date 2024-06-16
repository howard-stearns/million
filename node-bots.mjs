import { joinMillion } from './demo-join.mjs';

export async function launchBots(options, nBots) {
  // Launch the requested number of bots into the specified options.sessionName.
  // This will not be called until the inputs are prepared, and the computation will not start until
  // this resolves. However, it is perfectly fine for this return "early", before all the bots have joined the session.

  // This version is suitable for running the session in one big node process, for testing.
  // The session will already be running (and the model init'ed with parameters) before this is called.
  // (Options won't be used again, but it is part of defining session id and so it must match.)
  const promises = Array.from({length: nBots}, () => joinMillion(options));
  const sessions = await Promise.all(promises);
  // Now set them all to work, but don't wait for them to finish.
  sessions.forEach(session => {
    session.view.promiseOutput().then(() => session.leave());
  });
  return nBots;
}

