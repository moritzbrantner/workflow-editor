import type {
  WorkflowEditorPortProperty,
  WorkflowEditorPortType,
  WorkflowEditorTypeDefinition,
} from "./core";

type WorkflowEditorPortTypeAssignabilityState = {
  definitions: Map<string, WorkflowEditorTypeDefinition>;
  resolving: Set<string>;
};

export type WorkflowEditorTypeResolver = {
  isAssignable(source: WorkflowEditorPortType, target: WorkflowEditorPortType): boolean;
  findResolutionErrors(type: WorkflowEditorPortType): string[];
  objectPropertiesFromType(
    type: WorkflowEditorPortType,
  ): Record<string, WorkflowEditorPortProperty> | null;
};

export function createWorkflowEditorTypeResolver(
  typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [],
): WorkflowEditorTypeResolver {
  const definitions = new Map(typeDefinitions.map((definition) => [definition.name, definition]));

  return {
    isAssignable(source, target) {
      return isWorkflowEditorPortTypeAssignableWithState(
        source,
        target,
        {
          definitions,
          resolving: new Set(),
        },
        0,
      );
    },

    findResolutionErrors(type) {
      const errors: string[] = [];
      collectWorkflowEditorPortTypeResolutionErrors(type, definitions, [], errors);
      return errors;
    },

    objectPropertiesFromType(type) {
      return workflowEditorObjectPropertiesFromType(
        type,
        {
          definitions,
          resolving: new Set(),
        },
        0,
      );
    },
  };
}

export function workflowEditorObjectPropertiesFromType(
  type: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
  depth: number,
): Record<string, WorkflowEditorPortProperty> | null {
  if (depth > 100) {
    return null;
  }

  const resolvedType = resolveWorkflowEditorPortType(type, state);

  if (!resolvedType) {
    return null;
  }

  if (resolvedType !== type) {
    return workflowEditorObjectPropertiesFromType(resolvedType, state, depth + 1);
  }

  if (type.kind === "object") {
    return type.properties ?? {};
  }

  if (type.kind !== "intersection") {
    return null;
  }

  let merged: Record<string, WorkflowEditorPortProperty> | null = null;

  for (const intersectionType of type.types) {
    const properties = workflowEditorObjectPropertiesFromType(intersectionType, state, depth + 1);

    if (!properties) {
      continue;
    }

    merged ??= {};

    for (const [propertyName, property] of Object.entries(properties)) {
      const existing = merged[propertyName];

      merged[propertyName] = existing
        ? {
            optional: existing.optional && property.optional,
            type: { kind: "intersection", types: [existing.type, property.type] },
          }
        : property;
    }
  }

  return merged;
}

function isWorkflowEditorPortTypeAssignableWithState(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
  depth: number,
): boolean {
  if (depth > 100) {
    return false;
  }

  const resolvedSource = resolveWorkflowEditorPortType(source, state);
  const resolvedTarget = resolveWorkflowEditorPortType(target, state);

  if (!resolvedSource || !resolvedTarget) {
    return false;
  }

  if (resolvedSource !== source) {
    return isWorkflowEditorPortTypeAssignableWithState(resolvedSource, target, state, depth + 1);
  }

  if (resolvedTarget !== target) {
    return isWorkflowEditorPortTypeAssignableWithState(source, resolvedTarget, state, depth + 1);
  }

  if (source.kind === "any" || target.kind === "any") {
    return true;
  }

  if (target.kind === "unknown" || source.kind === "never") {
    return true;
  }

  if (source.kind === "unknown") {
    return false;
  }

  if (target.kind === "never") {
    return false;
  }

  if (target.kind === "union") {
    return target.types.some((type) =>
      isWorkflowEditorPortTypeAssignableWithState(source, type, state, depth + 1),
    );
  }

  if (source.kind === "union") {
    return source.types.every((type) =>
      isWorkflowEditorPortTypeAssignableWithState(type, target, state, depth + 1),
    );
  }

  if (target.kind === "intersection") {
    return target.types.every((type) =>
      isWorkflowEditorPortTypeAssignableWithState(source, type, state, depth + 1),
    );
  }

  if (source.kind === "intersection" && target.kind !== "object") {
    return source.types.some((type) =>
      isWorkflowEditorPortTypeAssignableWithState(type, target, state, depth + 1),
    );
  }

  if (source.kind === "literal") {
    if (target.kind === "literal") {
      return source.value === target.value;
    }

    return target.kind === workflowEditorPrimitiveKindForLiteral(source.value);
  }

  if (target.kind === "literal") {
    return false;
  }

  if (isWorkflowEditorPrimitivePortTypeKind(source.kind)) {
    return source.kind === target.kind;
  }

  if (source.kind === "array" && target.kind === "array") {
    return isWorkflowEditorPortTypeAssignableWithState(
      source.element,
      target.element,
      state,
      depth + 1,
    );
  }

  if (target.kind === "object") {
    return isWorkflowEditorObjectPortTypeAssignable(source, target, state, depth + 1);
  }

  return false;
}

function resolveWorkflowEditorPortType(
  type: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
): WorkflowEditorPortType | null {
  if (type.kind !== "ref") {
    return type;
  }

  if (state.resolving.has(type.name)) {
    return null;
  }

  const definition = state.definitions.get(type.name);

  if (!definition) {
    return null;
  }

  state.resolving.add(type.name);

  const parentTypes: WorkflowEditorPortType[] = [];

  for (const parentName of definition.extends ?? []) {
    const parentType = resolveWorkflowEditorPortType({ kind: "ref", name: parentName }, state);

    if (!parentType) {
      state.resolving.delete(type.name);
      return null;
    }

    parentTypes.push(parentType);
  }

  state.resolving.delete(type.name);

  if (parentTypes.length === 0) {
    return definition.type;
  }

  return {
    kind: "intersection",
    types: [...parentTypes, definition.type],
  };
}

function isWorkflowEditorObjectPortTypeAssignable(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
  depth: number,
) {
  const sourceProperties = workflowEditorObjectPropertiesFromType(source, state, depth);
  const targetProperties = workflowEditorObjectPropertiesFromType(target, state, depth);

  if (!sourceProperties || !targetProperties) {
    return false;
  }

  for (const [propertyName, targetProperty] of Object.entries(targetProperties)) {
    const sourceProperty = sourceProperties[propertyName];

    if (!sourceProperty) {
      if (targetProperty.optional) {
        continue;
      }

      return false;
    }

    if (sourceProperty.optional && !targetProperty.optional) {
      return false;
    }

    if (
      !isWorkflowEditorPortTypeAssignableWithState(
        sourceProperty.type,
        targetProperty.type,
        state,
        depth + 1,
      )
    ) {
      return false;
    }
  }

  return true;
}

function collectWorkflowEditorPortTypeResolutionErrors(
  type: WorkflowEditorPortType,
  definitions: Map<string, WorkflowEditorTypeDefinition>,
  stack: string[],
  errors: string[],
) {
  switch (type.kind) {
    case "array":
      collectWorkflowEditorPortTypeResolutionErrors(type.element, definitions, stack, errors);
      return;
    case "object":
      for (const property of Object.values(type.properties ?? {})) {
        collectWorkflowEditorPortTypeResolutionErrors(property.type, definitions, stack, errors);
      }
      return;
    case "union":
    case "intersection":
      for (const childType of type.types) {
        collectWorkflowEditorPortTypeResolutionErrors(childType, definitions, stack, errors);
      }
      return;
    case "ref": {
      if (stack.includes(type.name)) {
        errors.push(`Cyclic workflow port type reference: ${[...stack, type.name].join(" -> ")}`);
        return;
      }

      const definition = definitions.get(type.name);

      if (!definition) {
        errors.push(`Missing workflow port type definition: ${type.name}`);
        return;
      }

      const nextStack = [...stack, type.name];

      for (const parentName of definition.extends ?? []) {
        collectWorkflowEditorPortTypeResolutionErrors(
          { kind: "ref", name: parentName },
          definitions,
          nextStack,
          errors,
        );
      }

      collectWorkflowEditorPortTypeResolutionErrors(
        definition.type,
        definitions,
        nextStack,
        errors,
      );
      return;
    }
    default:
      return;
  }
}

function isWorkflowEditorPrimitivePortTypeKind(kind: WorkflowEditorPortType["kind"]) {
  return (
    kind === "string" ||
    kind === "number" ||
    kind === "boolean" ||
    kind === "null" ||
    kind === "undefined"
  );
}

function workflowEditorPrimitiveKindForLiteral(
  value: string | number | boolean | null,
): "string" | "number" | "boolean" | "null" {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return "string";
  }

  if (typeof value === "number") {
    return "number";
  }

  return "boolean";
}
