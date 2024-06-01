/**
 * What is this file for?
 *
 * It is used to perform code manipulation so that code can run successfully in workerd,
 * the issues being addressed here are triggered when esm code imports from cjs files,
 * and the issues are the following two (note: they will hopefully be fixed soon in workerd making this unnecessary):
 *
 * NOTE: this file should hopefully soon be unnecessary (https://github.com/cloudflare/workerd/pull/2194)
 *
 * #1) workerd fails to import from esm named exports from cjs files
 *     for example:
 *     ``` // a.cjs
 *       exports.abc = 'a, b and c';
 *     ```
 *     ``` // index.mjs
 *       import { abc } from './a.cjs'; // <-- this errors saying that the requested module does not provide an export named 'abc'
 *     ```
 *     so we need to update the latter import to:
 *     ``` // index.mjs (fixed)
 *       import X from './a.cjs';
 *       const { abc } = X;
 *     ```
 *
 * #2) workerd fails to import from esm namespaced imports from cjs files
 *     for example:
 *     ``` // a.cjs
 *       exports.hello = () => 'hello world';
 *     ```
 *     ``` // index.mjs
 *       import * as A from './a.cjs';
 *       A.hello() // <-- this errors saying that A.hello is not a function
 *     ```
 *     so we need to update the latter import to:
 *     ``` // index.mjs (fixed)
 *       import * as X from './a.cjs';
 *       const A = X.default;
 *     ```
 */
import * as recast from 'recast';
import { parser } from 'recast/parsers/babel';

export function adjustCodeForWorkerd(inputCode: string): string {
  const getTransformedImportModuleName = (() => {
    let importCounter = 0;
    return function getTransformedImportModuleName() {
      return `__transformed_import__${importCounter++}`;
    };
  })();

  const ast = recast.parse(inputCode, {
    parser,
  }) as recast.types.namedTypes.File;

  const consts: recast.types.namedTypes.VariableDeclaration[] = [];

  recast.visit(ast, {
    visitImportDeclaration(path) {
      const importInfo = detectTypeOfImport(path.value);

      if (importInfo.typeOfImport === 'namespaceImport') {
        handleNamespaceImport(path.value, importInfo.namespaceSpecifier);
      }

      if (importInfo.typeOfImport === 'symbolsImport') {
        handleSymbolsImport(path.value, importInfo.importedSymbols);
      }

      this.traverse(path);
    },
  });

  injectPostImportsConsts(ast, consts);
  return recast.print(ast).code;

  function handleSymbolsImport(
    importDeclaration: recast.types.namedTypes.ImportDeclaration,
    importedSymbols: { identifier: string; renamedIdentifier?: string }[],
  ) {
    const transformedImportModuleName = getTransformedImportModuleName();

    const newSpecifiers =
      parseStatement<recast.types.namedTypes.ImportDeclaration>(
        `import * as ${transformedImportModuleName} from "${importDeclaration.source.value}";`,
      ).specifiers;

    importDeclaration.specifiers = newSpecifiers;

    const constDeclaration =
      parseStatement<recast.types.namedTypes.VariableDeclaration>(
        `const {${importedSymbols
          .map(
            ({ identifier, renamedIdentifier }) =>
              `${identifier}${
                renamedIdentifier ? `: ${renamedIdentifier}` : ''
              }`,
          )
          .join(', ')}} = ${transformedImportModuleName};`,
      );

    consts.push(constDeclaration);
  }

  function handleNamespaceImport(
    importDeclaration: recast.types.namedTypes.ImportDeclaration,
    namespaceSpecifier: recast.types.namedTypes.ImportNamespaceSpecifier,
  ) {
    const namespaceSymbol = namespaceSpecifier.local?.name;
    if (!namespaceSymbol) {
      return;
    }

    const transformedImportModuleName = getTransformedImportModuleName();

    const newSpecifiers =
      parseStatement<recast.types.namedTypes.ImportDeclaration>(
        `import * as ${transformedImportModuleName} from "${importDeclaration.source.value}";`,
      ).specifiers;

    importDeclaration.specifiers = newSpecifiers;

    const constDeclaration =
      parseStatement<recast.types.namedTypes.VariableDeclaration>(
        `const ${namespaceSymbol} = ${transformedImportModuleName}.default;`,
      );

    consts.push(constDeclaration);
  }
}

function detectTypeOfImport(
  importDeclaration: recast.types.namedTypes.ImportDeclaration,
):
  | {
      typeOfImport: 'not-detected';
    }
  | {
      // The import is like: `import * as A from './a.cjs';`
      typeOfImport: 'namespaceImport';
      namespaceSpecifier: recast.types.namedTypes.ImportNamespaceSpecifier;
    }
  | {
      // The import is like: `import { abc } from './a.cjs';`
      typeOfImport: 'symbolsImport';
      importedSymbols: { identifier: string; renamedIdentifier?: string }[];
    } {
  const specifiers = importDeclaration.specifiers;

  const namespaceSpecifier =
    specifiers?.length === 1 &&
    specifiers[0].type === 'ImportNamespaceSpecifier'
      ? specifiers[0]
      : null;

  if (namespaceSpecifier) {
    return {
      typeOfImport: 'namespaceImport',
      namespaceSpecifier,
    };
  }

  const importedSymbols = (specifiers ?? [])
    .map(s => {
      if (s.type === 'ImportSpecifier') {
        return {
          identifier: s.imported.name,
          renamedIdentifier:
            s.local?.name !== s.imported.name ? s.local?.name : undefined,
        };
      }
      return null;
    })
    .filter(Boolean) as { identifier: string; renamedIdentifier?: string }[];

  if (importedSymbols.length) {
    return {
      typeOfImport: 'symbolsImport',
      importedSymbols,
    };
  }

  return {
    typeOfImport: 'not-detected',
  };
}

function injectPostImportsConsts(
  ast: recast.types.namedTypes.File,
  consts: recast.types.namedTypes.VariableDeclaration[],
) {
  const numOfImports = ast.program.body
    .map(node => node.type)
    .filter(type => type === 'ImportDeclaration').length;

  ast.program.body = [
    ...ast.program.body.slice(0, numOfImports),
    ...consts,
    ...ast.program.body.slice(numOfImports),
  ];
}

function parseStatement<T extends recast.types.ASTNode = recast.types.ASTNode>(
  code: string,
): T {
  return recast.parse(code).program.body[0] as T;
}
