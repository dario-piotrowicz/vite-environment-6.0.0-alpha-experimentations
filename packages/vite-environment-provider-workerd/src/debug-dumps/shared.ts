import { mkdir, readdir } from "node:fs/promises";

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
