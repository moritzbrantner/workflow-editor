import ts from "typescript";
import { workflowTypeLibraries, workflowTypeLibraryFiles } from "./core-type-libraries";
import type {
  WorkflowEditorPortProperty,
  WorkflowEditorPortType,
  WorkflowEditorTypeDefinition,
} from "./core-types";
import {
  workflowEditorPortTypeSource,
  workflowEditorTypeDefinitionsSource,
  workflowEditorLegacyTypeName,
} from "./core-type-source";

export type WorkflowEditorTypeCheck = {
  source: WorkflowEditorPortType;
  target?: WorkflowEditorPortType;
  propertyKeys?: readonly string[];
};
export type WorkflowEditorTypeResolver = {
  readonly programBuildCount: number;
  prepareChecks(checks: readonly WorkflowEditorTypeCheck[]): void;
  isAssignable(source: WorkflowEditorPortType, target: WorkflowEditorPortType): boolean;
  compatibilityErrors(source: WorkflowEditorPortType, target: WorkflowEditorPortType): string[];
  findResolutionErrors(type: WorkflowEditorPortType): string[];
  objectPropertiesFromType(
    type: WorkflowEditorPortType,
    propertyKeys?: readonly string[],
  ): Record<string, WorkflowEditorPortProperty> | null;
};

const librarySources = workflowTypeLibraries;
const libraryFiles = workflowTypeLibraryFiles;
const compilerOptions: ts.CompilerOptions = {
  strict: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  types: [],
  skipLibCheck: true,
};
type CheckedType = {
  errors: string[];
  properties: Record<string, WorkflowEditorPortProperty> | null;
};
const fileName = "/workflow.ts";

// Bounded immutable-environment cache. Declaration edits change the key; no stale checker
// can survive a changed catalog or document. Repeated pointer validation reuses results.
const resolvers = new Map<string, WorkflowEditorTypeResolver>();

export function createWorkflowEditorTypeResolver(
  typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [],
  typeDeclarations = "",
): WorkflowEditorTypeResolver {
  const key = JSON.stringify([typeDefinitions, typeDeclarations]);
  const existing = resolvers.get(key);
  if (existing) {
    return existing;
  }
  const declarations =
    workflowEditorTypeDefinitionsSource(typeDefinitions) + "\n" + typeDeclarations;
  const results = new Map<string, CheckedType>();

  let previousProgram: ts.Program | undefined;
  let programBuildCount = 0;
  const declarationFile = ts.createSourceFile(
    "/declarations.ts",
    typeDeclarations,
    ts.ScriptTarget.Latest,
    true,
  );
  const invalidDeclaration = declarationFile.statements.some(
    (statement) =>
      (!ts.isTypeAliasDeclaration(statement) &&
        !ts.isInterfaceDeclaration(statement) &&
        !ts.isEmptyStatement(statement)) ||
      ("name" in statement &&
        ts.isIdentifier(statement.name as ts.Node) &&
        (statement.name as ts.Identifier).text.startsWith("__Workflow")),
  );
  const formatDiagnostic = (diagnostic: ts.Diagnostic) => {
    let message = `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    for (const definition of typeDefinitions) {
      const encoded = workflowEditorLegacyTypeName(definition.name);
      if (encoded !== definition.name) {
        message = message.replaceAll(encoded, definition.name);
      }
    }
    return message;
  };
  const expressionErrors = (expression: string): string[] => {
    const parsed = ts.createSourceFile(
      "/expression.ts",
      `type __WorkflowCheck = (${expression});`,
      ts.ScriptTarget.Latest,
      true,
    );
    // Parser diagnostics belong to TypeScript. Reading them avoids constructing a second
    // semantic program merely to isolate malformed fragments from a valid batch.
    const syntax = (parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
      .parseDiagnostics;
    if (syntax.length) {
      return syntax.map(formatDiagnostic);
    }
    if (parsed.statements.length !== 1 || !ts.isTypeAliasDeclaration(parsed.statements[0]!)) {
      return ["Workflow ports accept a single TypeScript type expression."];
    }
    let internalReference = false;
    const visit = (node: ts.Node) => {
      const name = ts.isTypeReferenceNode(node)
        ? node.typeName
        : ts.isTypeQueryNode(node)
          ? node.exprName
          : undefined;
      if (name && ts.isIdentifier(name) && name.text.startsWith("__WorkflowCheck")) {
        internalReference = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed.statements[0]!);
    return internalReference
      ? ["Internal checker aliases are not workflow type declarations."]
      : [];
  };
  const remember = (key: string, result: CheckedType) => {
    if (results.size >= 4096 && !results.has(key)) {
      results.delete(results.keys().next().value!);
    }
    results.set(key, result);
  };
  function prepareChecks(checks: readonly WorkflowEditorTypeCheck[]) {
    const pending = new Map<string, { source: string; target?: string; propertyKeys: string[] }>();
    for (const request of checks) {
      const source = workflowEditorPortTypeSource(request.source);
      const target =
        request.target === undefined ? undefined : workflowEditorPortTypeSource(request.target);
      const propertyKeys = [...new Set(request.propertyKeys ?? [])].sort();
      const key = JSON.stringify([source, target, propertyKeys]);
      if (results.has(key) || pending.has(key)) {
        continue;
      }
      let errors = [
        ...expressionErrors(source),
        ...(target === undefined ? [] : expressionErrors(target)),
      ];
      if (invalidDeclaration) {
        errors.push(
          "Workflow types accept only type/interface declarations; imports and executable statements are not supported.",
        );
      }
      if (hasTypeScriptSuppression([declarations, source, target ?? ""].join("\n"))) {
        errors.push(
          "TypeScript suppression comments (@ts-nocheck, @ts-ignore, @ts-expect-error) are not supported in workflow types.",
        );
      }
      if (errors.length) {
        remember(key, { errors: [...new Set(errors)], properties: null });
        continue;
      }
      pending.set(key, { source, propertyKeys, ...(target === undefined ? {} : { target }) });
    }
    if (!pending.size) {
      return;
    }
    let code = declarations + "\n";
    const segments = [...pending].map(([key, request], index) => {
      const start = code.length;
      const alias = `__WorkflowCheckSource_${index}`;
      code += `type ${alias} = (${request.source});\n`;
      if (request.target !== undefined) {
        code += `type __WorkflowCheckTarget_${index} = (${request.target}); declare const __WorkflowCheckValue_${index}: ${alias}; const __WorkflowCheckResult_${index}: __WorkflowCheckTarget_${index} = __WorkflowCheckValue_${index};\n`;
      }
      const end = code.length;
      const accesses = request.propertyKeys.map((propertyKey, propertyIndex) => {
        const start = code.length;
        const name = `__WorkflowCheckProperty_${index}_${propertyIndex}`;
        code += `declare const __WorkflowCheckInput_${index}_${propertyIndex}: ${alias}; const ${name} = __WorkflowCheckInput_${index}_${propertyIndex}[${JSON.stringify(propertyKey)}];\n`;
        return { propertyKey, name, start, end: code.length };
      });
      return { key, alias, start, end, accesses, properties: request.target === undefined };
    });
    const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
    const host: ts.CompilerHost = {
      getSourceFile: (name) => (name === fileName ? sourceFile : libraryFiles.get(name)),
      getDefaultLibFileName: () => "/lib.es2022.full.d.ts",
      writeFile: () => {},
      getCurrentDirectory: () => "/",
      getDirectories: () => [],
      fileExists: (name) => name === fileName || libraryFiles.has(name),
      readFile: (name) => (name === fileName ? code : librarySources.get(name)),
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
    };
    const program = ts.createProgram({
      rootNames: [fileName],
      options: compilerOptions,
      host,
      ...(previousProgram ? { oldProgram: previousProgram } : {}),
    });
    programBuildCount++;
    previousProgram = program;
    const diagnostics = [
      ...program.getGlobalDiagnostics(),
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ];
    const globalErrors = diagnostics.filter(
      (diagnostic) => diagnostic.start === undefined || diagnostic.start < segments[0]!.start,
    );
    const checker = program.getTypeChecker();
    const aliases = new Map(
      sourceFile.statements.flatMap((statement) =>
        ts.isTypeAliasDeclaration(statement) ? [[statement.name.text, statement] as const] : [],
      ),
    );
    const accessExpressions = new Map(
      sourceFile.statements.flatMap((statement) =>
        ts.isVariableStatement(statement)
          ? statement.declarationList.declarations.flatMap((declaration) =>
              ts.isIdentifier(declaration.name) && declaration.initializer
                ? [[declaration.name.text, declaration.initializer] as const]
                : [],
            )
          : [],
      ),
    );
    for (const segment of segments) {
      const errors = [
        ...new Set(
          [
            ...globalErrors,
            ...diagnostics.filter(
              (diagnostic) =>
                diagnostic.start !== undefined &&
                diagnostic.start >= segment.start &&
                diagnostic.start < segment.end,
            ),
          ].map(formatDiagnostic),
        ),
      ];
      const alias = aliases.get(segment.alias);
      const type = alias ? checker.getTypeFromTypeNode(alias.type) : undefined;
      const properties =
        !segment.properties ||
        errors.length ||
        !type ||
        !(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection | ts.TypeFlags.Union))
          ? null
          : Object.fromEntries(
              checker.getPropertiesOfType(type).map((symbol) => {
                const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
                const propertyType = declaration
                  ? checker.getTypeOfSymbolAtLocation(symbol, declaration)
                  : checker.getDeclaredTypeOfSymbol(symbol);
                return [
                  symbol.name,
                  {
                    optional: Boolean(symbol.flags & ts.SymbolFlags.Optional),
                    type: portTypeFromChecker(checker, propertyType),
                  },
                ];
              }),
            );
      if (properties && type) {
        for (const access of segment.accesses) {
          const expression = accessExpressions.get(access.name);
          const invalidAccess = diagnostics.some(
            (diagnostic) =>
              diagnostic.start !== undefined &&
              diagnostic.start >= access.start &&
              diagnostic.start < access.end,
          );
          if (expression && !invalidAccess) {
            const symbol = checker.getPropertyOfType(type, access.propertyKey);
            properties[access.propertyKey] = {
              optional: Boolean(symbol && symbol.flags & ts.SymbolFlags.Optional),
              type: portTypeFromChecker(checker, checker.getTypeAtLocation(expression)),
            };
          }
        }
      }
      remember(segment.key, { errors, properties });
    }
  }
  function check(
    source: WorkflowEditorPortType,
    target?: WorkflowEditorPortType,
    propertyKeys: readonly string[] = [],
  ): CheckedType {
    const key = JSON.stringify([
      workflowEditorPortTypeSource(source),
      target === undefined ? undefined : workflowEditorPortTypeSource(target),
      [...new Set(propertyKeys)].sort(),
    ]);
    prepareChecks([{ source, propertyKeys, ...(target === undefined ? {} : { target }) }]);
    return results.get(key)!;
  }
  const resolver: WorkflowEditorTypeResolver = {
    get programBuildCount() {
      return programBuildCount;
    },
    prepareChecks,
    isAssignable(source, target) {
      return this.compatibilityErrors(source, target).length === 0;
    },
    compatibilityErrors(source, target) {
      return check(source, target).errors;
    },
    findResolutionErrors(type) {
      return check(type).errors;
    },
    objectPropertiesFromType(type, propertyKeys) {
      return check(type, undefined, propertyKeys).properties;
    },
  };
  if (resolvers.size >= 8) {
    resolvers.delete(resolvers.keys().next().value!);
  }
  resolvers.set(key, resolver);
  return resolver;
}

function portTypeFromChecker(checker: ts.TypeChecker, type: ts.Type): WorkflowEditorPortType {
  const source = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
  switch (source) {
    case "any":
    case "unknown":
    case "never":
    case "string":
    case "number":
    case "boolean":
    case "null":
    case "undefined":
      return { kind: source };
    default:
      return { kind: "typescript", source };
  }
}

function hasTypeScriptSuppression(source: string): boolean {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      (token === ts.SyntaxKind.SingleLineCommentTrivia ||
        token === ts.SyntaxKind.MultiLineCommentTrivia) &&
      /@ts-(?:nocheck|ignore|expect-error)\b/.test(scanner.getTokenText())
    ) {
      return true;
    }
  }
  return false;
}
