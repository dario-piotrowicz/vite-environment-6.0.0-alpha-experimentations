import { Form, json, useLoaderData } from '@remix-run/react';

export const meta = () => {
  return [
    { title: 'New Remix App' },
    {
      name: 'description',
      content: 'Welcome to Remix! Using Vite and Cloudflare!',
    },
  ];
};

function getUserAgentText(): string {
  if (typeof navigator === 'undefined') {
    return 'navigator is undefined (running in Node.js?)';
  } else {
    const userAgent = navigator.userAgent;
    return `navigator.userAgent = ${userAgent}`;
  }
}

export async function loader() {
  return json({ userAgentText: getUserAgentText() });
}

export async function action() {
  console.log(`\x1b[32m no-op action \x1b[0m`);
  return null;
}

export default function Index() {
  const { userAgentText } = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <h1>Welcome to Remix (with Vite and Cloudflare)</h1>
      <hr />
      <h2>{userAgentText}</h2>
      <hr />
      <p>No-op form</p>
      <Form method="POST">
        <button>Click me</button>
      </Form>
    </div>
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('HMR message!');
  });
}
