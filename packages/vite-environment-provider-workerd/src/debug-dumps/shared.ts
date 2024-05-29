import { appendFile, mkdir, readdir, writeFile } from 'node:fs/promises';

const cwd = process.cwd();
const runsDir = `${cwd}/.workerd-env-dumps`;
const runNumber =
  `${(await readdir(runsDir).catch(() => ({ length: 0 }))).length}`.padStart(
    2,
    '0',
  );
const runName = `dev_run_${runNumber}`;
const runDir = `${runsDir}/${runName}`;
await mkdir(runDir, { recursive: true });

export { runDir };

const allImportsFilePath = `${runDir}/all-imports.txt`;
await writeFile(allImportsFilePath, '');

let importsCounter = 0;

export async function getImportCounterStr(
  source: string,
  importPath: string,
): Promise<string> {
  const importCountStr = `${importsCounter}`.padStart(3, '0');
  importsCounter++;
  const importStr = `import[${importCountStr}]`;
  await appendFile(
    allImportsFilePath,
    `${importStr}[ ${source.padEnd(23)}]: ${importPath}\n`,
  );
  return importStr;
}
