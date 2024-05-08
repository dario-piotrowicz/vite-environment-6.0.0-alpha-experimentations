import { serverSideRender } from './src/server/index';

async function fetch(_request: Request) {
    const html = await serverSideRender();

    return new Response(html, {
      headers: {
        'content-type': 'text/html',
      },
    });
};

export default fetch;