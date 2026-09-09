/**
 * Lets `node --test` load our TypeScript the way tsconfig (moduleResolution: bundler) allows it to be written:
 * relative imports without an extension. Node's type stripping needs the `.ts`, so ts-hooks.mjs adds it.
 *
 *   node --import ./scripts/register-ts.mjs --test lib/*.test.ts
 */
import { register } from 'node:module';

register('./ts-hooks.mjs', import.meta.url);
