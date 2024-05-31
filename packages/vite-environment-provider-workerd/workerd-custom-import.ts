module.exports = async (path: string) => {
  try {
    const result = await import(path);
    // TODO: investigate why we need the following
    return {
      ...result,
      ...(result.default ?? {}),
    };
  } catch (e) {
    // return the following string instead of a module to make the potential issue slightly clearer
    return '__CUSTOM_IMPORT__module_not_loaded__';
  }
};
