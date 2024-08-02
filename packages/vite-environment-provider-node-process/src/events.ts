const PREFIX = '__PRIVATE__';

export type ParentEvent = 'initialize' | 'hmr' | 'transport';
export type ChildEvent = 'initialized' | 'transport';

export function createEventSender<T extends string>(
  send: (event: string) => void,
) {
  return (type: T, data?: any) => {
    send(`${PREFIX}${JSON.stringify({ type, data })}`);
  };
}

type Listener<T> = (event: { type: T; data: any }) => void;

export function createEventProcessor<T extends string>(
  initRootListener: (listen: (data: Buffer) => void) => void,
  nonEventListener?: (input: string) => void,
) {
  const listeners = new Set<Listener<T>>();

  initRootListener(data => {
    let buffer = '';
    buffer += data;
    let lines = buffer.split('\n');

    lines.forEach(line => {
      if (line.startsWith(PREFIX)) {
        listeners.forEach(listener =>
          listener(JSON.parse(line.substring(PREFIX.length))),
        );
      } else {
        nonEventListener?.(line);
      }
    });
  });

  return {
    addListener(listener: Listener<T>) {
      listeners.add(listener);
    },
    removeListener(listener: Listener<T>) {
      listeners.delete(listener);
    },
  };
}
