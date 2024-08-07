if (import.meta.hot) {
  import.meta.hot.accept(newModule => {
    console.log(
      `Updated userAgent (import.meta.hot.accept is working). New getUserAgentText return value is '${newModule.getUserAgentText()}'.`,
    );

    import.meta.hot.send('ssr-event', 'Hello from ssr environment');

    import.meta.hot.data.count =
      typeof import.meta.hot.data.count === 'number'
        ? import.meta.hot.data.count + 1
        : 0;

    console.log(
      `Updated count (import.meta.hot.data is working). New count value is ${import.meta.hot.data.count}.`,
    );
  });

  import.meta.hot.on('plugin-event', payload => {
    console.log(
      `Received custom event (import.meta.hot.on is working). Payload value is '${payload}'.`,
    );
  });
}

export function getUserAgentText(): string {
  if (typeof navigator === 'undefined') {
    return 'navigator is undefined (running in Node.js?)';
  } else {
    const userAgent = navigator.userAgent;
    return `navigator.userAgent = ${userAgent}!`;
  }
}
