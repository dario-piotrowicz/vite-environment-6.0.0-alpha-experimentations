const PREFIX = '__PRIVATE__';

export type ParentEvent = 'initialize' | 'hmr' | 'transport';
export type ChildEvent = 'initialized' | 'hmr' | 'transport';

export type EventSender<T> = (type: T, data?: any) => void;

export function createEventSender<T extends string>(
  send: (event: string) => void,
): EventSender<T> {
  return (type, data) => {
    send(`${PREFIX}${JSON.stringify({ type, data })}\n`);
  };
}

type Listener<T> = (event: { type: T; data: any }) => void;

export interface EventReceiver<T> {
  addListener(listener: Listener<T>): void;
  removeListener(listener: Listener<T>): void;
}

export function createEventReceiver<T extends string>(
  initRootListener: (listen: (data: Buffer) => void) => void,
  nonEventListener?: (input: string) => void,
): EventReceiver<T> {
  const listeners = new Set<Listener<T>>();
  let buffer = '';

  initRootListener(data => {
    buffer += data;
    let lines = buffer.split('\n');

    lines.slice(0, -1).forEach(line => {
      if (line.startsWith(PREFIX)) {
        listeners.forEach(listener =>
          listener(JSON.parse(line.substring(PREFIX.length))),
        );
      } else {
        nonEventListener?.(line);
      }
    });

    buffer = lines[lines.length - 1];
  });

  return {
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
  };
}
