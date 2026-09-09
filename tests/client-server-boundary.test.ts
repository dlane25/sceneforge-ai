import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const extensions = ['', '.ts', '.tsx', '.js', '.jsx'];
const guardedModules = [
  'auth.ts',
  'components/layout/main-layout.tsx',
  'components/layout/session-nav.tsx',
  'lib/auth/index.ts',
  'lib/auth/authjs.ts',
  'lib/db/index.ts',
  'lib/db/client.ts',
  'lib/repositories/prisma.ts',
  'lib/repositories/runtime.ts',
  'lib/series/runtime.ts',
  'lib/media/runtime.ts',
  'lib/assembly/runtime.ts',
  'lib/launch/runtime.ts',
  'lib/health/runtime.ts',
  'lib/orchestration/runtime.ts',
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    return statSync(target).isDirectory() ? sourceFiles(target) : /\.[jt]sx?$/.test(entry) ? [target] : [];
  });
}

function valueImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const syntax = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, syntax);
  const imports: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const onlyTypes = Boolean(clause?.isTypeOnly || (clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every((element) => element.isTypeOnly)));
      if (!onlyTypes) imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) imports.push(node.moduleSpecifier.text);
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return imports;
}

function resolveLocalImport(from: string, specifier: string): string | undefined {
  const base = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier) : undefined;
  if (!base) return undefined;
  for (const extension of extensions) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return path.resolve(candidate);
  }
  for (const extension of extensions.slice(1)) {
    const candidate = path.join(base, `index${extension}`);
    if (existsSync(candidate)) return path.resolve(candidate);
  }
  return undefined;
}

describe('client/server module boundary', () => {
  it('keeps persistence, Prisma, authentication, and runtime entry points server-only', () => {
    for (const modulePath of guardedModules) expect(readFileSync(path.join(root, modulePath), 'utf8'), modulePath).toMatch(/^import ['"]server-only['"];?/);
  });

  it('prevents client component import graphs from reaching server-only modules', () => {
    const entries = [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'components'))].filter((file) => /^\s*['"]use client['"];?/.test(readFileSync(file, 'utf8')));
    const violations: string[] = [];
    const walk = (file: string, chain: string[], visited: Set<string>) => {
      if (visited.has(file)) return;
      visited.add(file);
      if (/^import ['"]server-only['"];?/.test(readFileSync(file, 'utf8'))) { violations.push([...chain, path.relative(root, file)].join(' -> ')); return; }
      for (const specifier of valueImports(file)) {
        const resolved = resolveLocalImport(file, specifier);
        if (resolved) walk(resolved, [...chain, path.relative(root, file)], visited);
      }
    };
    for (const entry of entries) walk(entry, [], new Set());
    expect(violations).toEqual([]);
  });
});
