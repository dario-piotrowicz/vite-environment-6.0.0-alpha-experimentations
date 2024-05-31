import { dirname } from 'node:path';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { getImportCounterStr, runDir } from './shared';

const moduleFallbackRunDir = `${runDir}/moduleFallback`;
await mkdir(moduleFallbackRunDir);
const moduleFallbackLogsFilePath = `${moduleFallbackRunDir}/logs.txt`;
await writeFile(moduleFallbackLogsFilePath, '');

export async function dumpModuleFallbackServiceLog(
  results: {
    resolveMethod: string;
    referrer: string;
    specifier: string;
    rawSpecifier: string;
    fixedSpecifier: string;
    resolvedId: string;
  } & (
    | {
        redirectTo: string;
      }
    | {
        code: string;
        isCommonJS: boolean;
      }
    | {
        notFound: true;
      }
  ),
) {
  await appendFile(
    moduleFallbackLogsFilePath,
    `\n\n${await getImportCounterStr('moduleFallback', results.resolvedId)}:\n${Object.keys(
      results,
    )
      .filter(key => key !== 'code')
      .filter(key => results[key] !== undefined)
      .map(value => `        ${value}: ${results[value]}`)
      .join('\n')}\n\n`,
  );

  if (results.resolvedId && !results['notFound']) {
    const filePath = `${moduleFallbackRunDir}/resolved/${results.resolvedId}`;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, 'code' in results ? results.code : '');
  }
}
