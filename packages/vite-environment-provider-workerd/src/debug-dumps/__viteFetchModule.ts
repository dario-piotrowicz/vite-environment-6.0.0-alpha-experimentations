import { dirname } from 'node:path';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { getImportCounterStr, runDir, debugDumpsEnabled } from './shared';

const __viteFetchModuleRunDir = `${runDir}/__viteFetchModule`;
const __viteFetchModuleImportsFilePath = `${__viteFetchModuleRunDir}/imports.txt`;

if (debugDumpsEnabled) {
  await mkdir(__viteFetchModuleRunDir);
  await writeFile(__viteFetchModuleImportsFilePath, '');
}

export async function dump__viteFetchModuleLog(
  __viteFetchModuleArgs: unknown,
  result: { externalize: string } | { code: string },
) {
  if (!debugDumpsEnabled) return;

  const importFilePath = __viteFetchModuleArgs[0] as string;

  await appendFile(
    __viteFetchModuleImportsFilePath,
    `${await getImportCounterStr('__viteFetchModule', importFilePath)}: ${importFilePath}${
      'externalize' in result ? ` (externalize to: ${result.externalize})` : ''
    }\n`,
  );

  const runFilePath = `${__viteFetchModuleRunDir}/imported/${importFilePath}`;
  await mkdir(dirname(runFilePath), { recursive: true });

  const importer = __viteFetchModuleArgs[1] as string | undefined;
  await writeFile(runFilePath, `// imported from ${importer ?? 'unknown'}\n`);

  if ('externalize' in result) {
    await appendFile(runFilePath, `// externalize: ${result.externalize}`);
  }

  if ('code' in result) {
    await appendFile(runFilePath, result.code);
  }
}
