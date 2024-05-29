import { appendFile, writeFile } from "fs/promises";
import { workerRunDir } from "./shared";

let runExternalModuleCounter = 0;

const logsFilePath = `${workerRunDir}/runExternalModuleLogs.txt`;
await writeFile(logsFilePath, '');


export async function dumpRunExternalModuleLog(filePath: string) {
    await appendFile(
      logsFilePath,
      `${`${runExternalModuleCounter}`.padStart(3, '0')}: ${filePath}\n`
    );

    runExternalModuleCounter++;
  }
