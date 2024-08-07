import { init as initCjsModuleLexer, parse } from 'cjs-module-lexer';
import { dirname, resolve } from 'node:path';
import { readFile, stat } from 'node:fs/promises';

export async function collectModuleInfo(
  moduleCode: string,
  moduleFilePath: string,
): Promise<CjsModuleInfo | EsmModuleInfo> {
  if (!isCommonJS(moduleCode)) {
    return { isCommonJS: false };
  }

  await initCjsModuleLexer();

  const namedExportsSet = new Set<string>();

  const cjsLexerResult = parse(moduleCode);
  cjsLexerResult.exports.forEach(namedExport =>
    namedExportsSet.add(namedExport),
  );
  for (const reExport of cjsLexerResult.reexports) {
    const reExportsPath = resolve(dirname(moduleFilePath), reExport);

    const reExportsFileStat = await stat(reExportsPath);
    if (!reExportsFileStat.isFile) {
      throw new Error(
        "Error: Found cjs re-export that doesn't point to a relative path",
      );
    }

    const reExportsCode = await readFile(reExportsPath, 'utf8');
    const reExportsInfo = await collectModuleInfo(reExportsCode, reExportsPath);

    if (reExportsInfo.isCommonJS) {
      reExportsInfo.namedExports.forEach(namedExport =>
        namedExportsSet.add(namedExport),
      );
    }
  }

  const namedExports = [...namedExportsSet.values()];

  return {
    isCommonJS: true,
    namedExports,
  };
}

type CjsModuleInfo = {
  isCommonJS: true;
  namedExports: string[];
};

type EsmModuleInfo = {
  isCommonJS: false;
};

function isCommonJS(code: string): boolean {
  const hasRequireCalls = /\brequire\s*\(\s*['"`][^'"`]+['"`]\s*\)/.test(code);
  if (hasRequireCalls) {
    return true;
  }

  const hasCjsExports =
    /\b(module\.exports|exports\.[a-zA-Z_$][0-9a-zA-Z_$]*)\s*=/.test(code);
  if (hasCjsExports) {
    return true;
  }

  return false;
}
