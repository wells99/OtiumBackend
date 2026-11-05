let queueTail = Promise.resolve();

export function enqueueRegistration(task) {
  const result = queueTail.then(task);
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}