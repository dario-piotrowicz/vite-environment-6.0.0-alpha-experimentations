import { dirname } from 'node:path';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { workerRunDir } from './shared';
import { getImportCounterStr } from '../shared';

const runInlineModuleRunDir = `${workerRunDir}/runInlineModule`;
await mkdir(runInlineModuleRunDir);
const logsFilePath = `${runInlineModuleRunDir}/logs.txt`;
await writeFile(logsFilePath, '');

export async function dumpRunInlineModuleLog({
  id,
  code,
}: {
  id: string;
  code: string;
}) {
  await appendFile(
    logsFilePath,
    `${`${await getImportCounterStr('worker/runInlineModule', id)}`.padStart(3, '0')}: ${id}\n`,
  );

  const filePath = `${runInlineModuleRunDir}/modules/${id}`;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, code);
}
