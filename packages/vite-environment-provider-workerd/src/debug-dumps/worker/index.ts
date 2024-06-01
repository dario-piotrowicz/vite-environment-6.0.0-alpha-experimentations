import { Request, Response } from 'miniflare';
import { dumpRunExternalModuleLog } from './runExternalModule';
import { dumpRunInlineModuleLog } from './runInlineModule';

export async function __debugDumpBinding(request: Request): Promise<Response> {
  await handleDumpRequest(request);
  return new Response('');
}

async function handleDumpRequest(request: Request) {
  if (request.method !== 'POST') return;

  if (request.url.endsWith('/runExternalModule')) {
    const { filepath } = (await request.json()) as { filepath: string };
    await dumpRunExternalModuleLog(filepath);
    return;
  }

  if (request.url.endsWith('/runInlineModule')) {
    const { id, code } = (await request.json()) as { id: string; code: string };
    await dumpRunInlineModuleLog({ id, code });
    return;
  }
}
