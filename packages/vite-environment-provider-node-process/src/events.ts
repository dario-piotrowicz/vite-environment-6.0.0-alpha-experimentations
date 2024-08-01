const PREFIX = '__PRIVATE__';

type ParentEvent = 'initialize' | 'hmr' | 'transport';
type ChildEvent = 'initialized' | 'transport';

function createEventCreator<T extends string>() {
  return (type: T, data?: any) => {
    return `${PREFIX}${JSON.stringify({ type, data })}`;
  };
}

function createEventProcessor<T extends string>() {
  return (
    buffer: Buffer,
    callback: (event: { type: T; data: any }) => void,
  ) => {
    const input = buffer.toString();

    if (input.startsWith(PREFIX)) {
      callback(JSON.parse(input.substring(PREFIX.length)));
    }
  };
}

export function processNonEvent(
  buffer: Buffer,
  callback: (input: string) => void,
) {
  const input = buffer.toString();

  if (!input.startsWith(PREFIX)) {
    callback(input);
  }
}

// parent events
export const createParentEvent = createEventCreator<ParentEvent>();
export const processParentEvent = createEventProcessor<ParentEvent>();

// child events
export const createChildEvent = createEventCreator<ChildEvent>();
export const processChildEvent = createEventProcessor<ChildEvent>();
