import { dirname } from 'node:path';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { workerRunDir } from './shared';

let runInlineModuleCounter = 0;

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
    `${`${runInlineModuleCounter}`.padStart(3, '0')}: ${id}\n`,
  );

  const filePath = `${runInlineModuleRunDir}/modules/${id}`;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, code);

  runInlineModuleCounter++;
}
