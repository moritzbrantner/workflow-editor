import ts from "typescript";
import { workflowTypeLibraries } from "./core-type-libraries";
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

export type WorkflowEditorTypeResolver = {
  isAssignable(source: WorkflowEditorPortType, target: WorkflowEditorPortType): boolean;
  compatibilityErrors(source: WorkflowEditorPortType, target: WorkflowEditorPortType): string[];
  findResolutionErrors(type: WorkflowEditorPortType): string[];
  objectPropertiesFromType(
    type: WorkflowEditorPortType,
  ): Record<string, WorkflowEditorPortProperty> | null;
};

const librarySources = workflowTypeLibraries;
const libraryFiles = new Map(
  [...librarySources].map(([name, source]) => [
    name,
    ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true),
  ]),
);
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

  function check(source: string, target?: string): CheckedType {
    const resultKey = JSON.stringify([source, target]);
    const cached = results.get(resultKey);
    if (cached) {
      return cached;
    }
    const code = `${declarations}\ntype __WorkflowSource = (${source});\n${target === undefined ? "" : `type __WorkflowTarget = (${target}); declare const __workflowValue: __WorkflowSource; const __workflowResult: __WorkflowTarget = __workflowValue;`}`;
    if (hasTypeScriptSuppression(code)) {
      return {
        errors: [
          "TypeScript suppression comments (@ts-nocheck, @ts-ignore, @ts-expect-error) are not supported in workflow types.",
        ],
        properties: null,
      };
    }
    const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
    const declarationFile = ts.createSourceFile(
      "/declarations.ts",
      typeDeclarations,
      ts.ScriptTarget.Latest,
      true,
    );
    const invalidDeclaration = declarationFile.statements.some(
      (statement) =>
        (!ts.isTypeAliasDeclaration(statement) && !ts.isInterfaceDeclaration(statement)) ||
        ("name" in statement &&
          ts.isIdentifier(statement.name as ts.Node) &&
          (statement.name as ts.Identifier).text.startsWith("__Workflow")),
    );
    const validExpression = (expression: string) => {
      const parsed = ts.createSourceFile(
        "/expression.ts",
        `type __WorkflowCheck = (${expression});`,
        ts.ScriptTarget.Latest,
        true,
      );
      return (
        parsed.statements.length === 1 &&
        ts.isTypeAliasDeclaration(parsed.statements[0]!) &&
        parsed.statements[0]!.name.text === "__WorkflowCheck"
      );
    };
    if (
      invalidDeclaration ||
      !validExpression(source) ||
      (target !== undefined && !validExpression(target))
    ) {
      return {
        errors: [
          "Workflow types accept only type/interface declarations and single TypeScript type expressions; imports and executable statements are not supported.",
        ],
        properties: null,
      };
    }
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
    const program = ts.createProgram([fileName], compilerOptions, host);
    const diagnostics = [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ];
    const errors = [
      ...new Set(
        diagnostics.map(
          (diagnostic) =>
            `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
        ),
      ),
    ];
    for (let i = 0; i < errors.length; i++) {
      for (const definition of typeDefinitions) {
        const encoded = workflowEditorLegacyTypeName(definition.name);
        if (encoded !== definition.name) {
          errors[i] = errors[i]!.replaceAll(encoded, definition.name);
        }
      }
    }
    const checker = program.getTypeChecker();
    const alias = sourceFile.statements.find(
      (statement): statement is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(statement) && statement.name.text === "__WorkflowSource",
    );
    const type = alias ? checker.getTypeFromTypeNode(alias.type) : undefined;
    const properties =
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
    const result = { errors, properties };
    if (results.size >= 128) {
      results.delete(results.keys().next().value!);
    }
    results.set(resultKey, result);
    return result;
  }
  const resolver: WorkflowEditorTypeResolver = {
    isAssignable(source, target) {
      return this.compatibilityErrors(source, target).length === 0;
    },
    compatibilityErrors(source, target) {
      return check(workflowEditorPortTypeSource(source), workflowEditorPortTypeSource(target))
        .errors;
    },
    findResolutionErrors(type) {
      return check(workflowEditorPortTypeSource(type)).errors;
    },
    objectPropertiesFromType(type) {
      return check(workflowEditorPortTypeSource(type)).properties;
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
