import { mkdir } from 'fs/promises';
import { runDir, debugDumpsEnabled } from '../shared';

const workerRunDir = `${runDir}/worker`;

if (debugDumpsEnabled) {
  await mkdir(workerRunDir);
}

export { workerRunDir };
