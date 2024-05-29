/**
 * NOTE: this file contains utilities only used for debugging and it's not really to be
 *       properly considered as part of the POC
 */
import { dirname } from "node:path";
import { appendFile, mkdir, readdir, writeFile } from 'node:fs/promises';

const cwd = process.cwd();
const runsDir = `${cwd}/.workerd-env-dumps`;
const runNumber = `${(await readdir(runsDir).catch(() => ({ length: 0 }))).length}`.padStart(2, '0');
const runName = `dev_run_${runNumber}`;
const runDir = `${runsDir}/${runName}`;
await mkdir(runDir, { recursive: true });

const __viteFetchModuleRunDir = `${runDir}/__viteFetchModule`;
await mkdir(__viteFetchModuleRunDir);
const importsTxtFilePath = `${__viteFetchModuleRunDir}/imports.txt`;
await writeFile(importsTxtFilePath, '');

let dump__viteFetchModuleCounter = 0;

export async function dump__viteFetchModuleLog(__viteFetchModuleArgs: unknown, result: { externalize: string } | { code: string }) {
    const importFilePath = (__viteFetchModuleArgs[0] as string).replace("/Users/dario/Repos/my-repos/", '/');

    await appendFile(
        importsTxtFilePath,
        `${`${dump__viteFetchModuleCounter}`.padStart(3, '0')} - ${importFilePath}${
            "externalize" in result ? ` (externalize to: ${result.externalize})` : ''
        }\n`
    );

    dump__viteFetchModuleCounter++;

    const runFilePath = `${__viteFetchModuleRunDir}/imported/${importFilePath}`;
    await mkdir(dirname(runFilePath), { recursive: true });

    const importer = (__viteFetchModuleArgs[1] as string|undefined)?.replace("/Users/dario/Repos/my-repos/", '/');
    await writeFile(runFilePath, `// imported from ${importer ?? 'unknown'}\n`);

    if("externalize" in result) {
        await appendFile(runFilePath, `// externalize: ${result.externalize}`);
    }

    if("code" in result) {
        await appendFile(runFilePath, result.code);
    }
}