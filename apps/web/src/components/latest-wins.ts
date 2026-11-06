/**
 * Cola de cambios en la que solo cuenta el último (#215): cada tarea espera a la anterior, las que ya quedaron
 * superadas no se ejecutan y `onIdle` se llama una sola vez, cuando termina la última pedida.
 */
export function createLatestWins() {
  let latest = 0;
  let chain: Promise<void> = Promise.resolve();
  return (task: (isCurrent: () => boolean) => Promise<void>, onIdle: () => void): Promise<void> => {
    const mine = ++latest;
    const isCurrent = () => mine === latest;
    const run = chain.then(() => (isCurrent() ? task(isCurrent) : undefined)).finally(() => { if (isCurrent()) onIdle(); });
    chain = run.catch(() => undefined);
    return run;
  };
}
