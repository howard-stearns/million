export function delay(ms) { // Promise to resolve after the specified milliseconds.
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function makeResolvablePromise() { // Return a promise with a 'resolve' property.
  let resolver, promise = new Promise(resolve => resolver = resolve);
  promise.resolve = resolver;
  return promise;
}
