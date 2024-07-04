export const Croquet = (typeof window !== 'undefined') ? window.Croquet : await import('@croquet/croquet');

export function delay(ms) { // Promise to resolve after the specified milliseconds.
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function makeResolvablePromise() { // Return a promise with a 'resolve' property.
  let resolver, promise = new Promise(resolve => resolver = resolve);
  promise.resolve = resolver;
  return promise;
}

export const performance = (typeof window !== 'undefined') ? window.performance : (await import('perf_hooks')).performance ;

// Ensure there is a definition of requestAnimationFrame -- even in NodeJS.
var pending = null;
export const requestAnimationFrame = (typeof(window) !== 'undefined') ? window.requestAnimationFrame :
  function requestAnimationFrame(handler) {
    if (pending) return;
    let paint = _ => { pending = null; handler(performance.now()); };
    pending = setTimeout(paint, 16);
  };

