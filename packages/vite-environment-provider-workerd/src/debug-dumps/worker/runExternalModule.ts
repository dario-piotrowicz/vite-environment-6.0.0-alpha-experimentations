import { appendFile, writeFile } from 'fs/promises';
import { workerRunDir } from './shared';
import { getImportCounterStr } from '../shared';

const logsFilePath = `${workerRunDir}/runExternalModuleLogs.txt`;
await writeFile(logsFilePath, '');

export async function dumpRunExternalModuleLog(filePath: string) {
  await appendFile(
    logsFilePath,
    `${await getImportCounterStr('moduleFallback', filePath)}: ${filePath}\n`,
  );
}
