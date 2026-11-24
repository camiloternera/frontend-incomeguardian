import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('review B3: existing budget use-case tests satisfy the current TypeScript contract', () => {
  const config = ts.readConfigFile('tsconfig.spec.json', ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const file = resolve('src/app/features/budgets/application/budget-use-cases.spec.ts');
  const program = ts.createProgram([file], { ...parsed.options, noEmit: true });
  const diagnostics = ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file && resolve(diagnostic.file.fileName) === file)
    .map((diagnostic) => ({
      line: diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }));

  expect(diagnostics).toEqual([]);
});
