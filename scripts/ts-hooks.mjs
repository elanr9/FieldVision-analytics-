/** Module resolution hook for register-ts.mjs: appends .ts/.tsx to extensionless relative imports. */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const target = fileURLToPath(new URL(specifier, context.parentURL));
    if (!isFile(target)) {
      for (const ext of ['.ts', '.tsx']) {
        if (isFile(target + ext)) return nextResolve(specifier + ext, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
