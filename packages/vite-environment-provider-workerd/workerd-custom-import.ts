module.exports = async (path: string) => {
  console.log(`\x1b[34mcustom import on ${path}\x1b[0m`);
  try {
    const result = await import(path);
    // TODO: investigate why we need the following
    return {
      ...result,
      ...(result.default ?? {}),
    };
  } catch (e) {
    console.log(`\x1b[31m custom import error \x1b[0m`, e);
    // return the following string instead of a module to make the potential issue slightly clearer
    return '__CUSTOM_IMPORT__module_not_loaded__';
  }
};
