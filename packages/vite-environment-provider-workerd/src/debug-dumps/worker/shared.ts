import { mkdir } from "fs/promises";
import { runDir } from "../shared";

const workerRunDir = `${runDir}/worker`;
await mkdir(workerRunDir);

export { workerRunDir };