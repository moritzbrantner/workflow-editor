import ts from "typescript";

import { workflowEditorPortTypeSource } from "./core-type-source";
import type { WorkflowEditorNodeComposition, WorkflowEditorPort } from "./core-types";

/**
 * TypeScript declarations carried by a shared template revision (#65, owner answer A of
 * 2026-10-21). Publishing copies the declarations its port types need from the source document;
 * a document that links the template adds the ones it does not declare itself.
 */

type Declaration = { names: string[]; text: string; references: Set<string> };

function identifiersIn(node: ts.Node, into = new Set<string>()) {
  if (ts.isIdentifier(node)) into.add(node.text);
  ts.forEachChild(node, (child) => void identifiersIn(child, into));
  return into;
}

function declaredNames(statement: ts.Statement): string[] {
  if (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isModuleDeclaration(statement) ||
    ts.isFunctionDeclaration(statement)
  ) {
    return statement.name && ts.isIdentifier(statement.name) ? [statement.name.text] : [];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  }
  return [];
}

function parseDeclarations(source: string): Declaration[] {
  const file = ts.createSourceFile("declarations.ts", source, ts.ScriptTarget.Latest, true);
  return file.statements.map((statement) => ({
    names: declaredNames(statement),
    text: statement.getText(file),
    references: identifiersIn(statement),
  }));
}

/** Identifiers referenced by TypeScript type sources such as port types. */
function referencedNames(typeSources: readonly string[]) {
  const names = new Set<string>();
  for (const source of typeSources) {
    const file = ts.createSourceFile(
      "type.ts",
      `type __WorkflowEditorType = ${source};`,
      ts.ScriptTarget.Latest,
      true,
    );
    identifiersIn(file, names);
  }
  names.delete("__WorkflowEditorType");
  return names;
}

/**
 * The declarations from `declarations` that `typeSources` need, including the declarations those
 * depend on, in their original order. Returns `""` when none are needed.
 */
export function extractWorkflowEditorTypeDeclarations(
  declarations: string | undefined,
  typeSources: readonly string[],
): string {
  if (!declarations?.trim()) return "";
  const parsed = parseDeclarations(declarations);
  const needed = referencedNames(typeSources);
  const included = new Set<Declaration>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const declaration of parsed) {
      if (included.has(declaration)) continue;
      if (declaration.names.some((name) => needed.has(name))) {
        included.add(declaration);
        for (const reference of declaration.references) needed.add(reference);
        grew = true;
      }
    }
  }
  return parsed
    .filter((declaration) => included.has(declaration))
    .map((declaration) => declaration.text)
    .join("\n");
}

/** Port type sources of a node and, recursively, of its composition. */
export function workflowEditorTemplateTypeSources(node: {
  inputs?: WorkflowEditorPort[];
  outputs?: WorkflowEditorPort[];
  composition?: WorkflowEditorNodeComposition<unknown>;
}): string[] {
  return [
    ...[...(node.inputs ?? []), ...(node.outputs ?? [])].map((port) =>
      workflowEditorPortTypeSource(port.type),
    ),
    ...(node.composition?.nodes ?? []).flatMap((child) =>
      workflowEditorTemplateTypeSources(
        child as Parameters<typeof workflowEditorTemplateTypeSources>[0],
      ),
    ),
  ];
}

/**
 * Adds the template's declarations that `documentDeclarations` does not declare yet. A name the
 * document already declares keeps the document's own declaration.
 */
export function mergeWorkflowEditorTypeDeclarations(
  documentDeclarations: string | undefined,
  templateDeclarations: string | undefined,
): string | undefined {
  if (!templateDeclarations?.trim()) return documentDeclarations;
  const existing = new Set(
    parseDeclarations(documentDeclarations ?? "").flatMap((declaration) => declaration.names),
  );
  const missing = parseDeclarations(templateDeclarations).filter(
    (declaration) =>
      declaration.names.length > 0 && declaration.names.every((name) => !existing.has(name)),
  );
  if (missing.length === 0) return documentDeclarations;
  return [documentDeclarations?.trimEnd(), ...missing.map((declaration) => declaration.text)]
    .filter(Boolean)
    .join("\n");
}
