import { appendFile, writeFile } from 'fs/promises';
import { workerRunDir } from './shared';
import { debugDumpsEnabled, getImportCounterStr } from '../shared';

const logsFilePath = `${workerRunDir}/runExternalModuleLogs.txt`;

if (debugDumpsEnabled) {
  await writeFile(logsFilePath, '');
}

export async function dumpRunExternalModuleLog(filePath: string) {
  if (!debugDumpsEnabled) return;

  await appendFile(
    logsFilePath,
    `${await getImportCounterStr('moduleFallback', filePath)}: ${filePath}\n`,
  );
}
