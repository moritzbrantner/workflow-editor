"use client";

import * as React from "react";
import { CheckIcon, RotateCcwIcon } from "lucide-react";

import {
  Badge,
  Button,
  Checkbox,
  EditorInspector,
  EditorInspectorContent,
  EditorInspectorFooter,
  EditorInspectorHeader,
  Input,
  PropertyRow,
  PropertySection,
  SelectDropdown,
  Slider,
  Textarea,
  cn,
} from "@moritzbrantner/ui";

type InspectorFieldValue = string | number | boolean | string[] | null | undefined;

type InspectorFieldOption = {
  label: string;
  value: string | number | boolean;
};

type InspectorFieldDefinition = {
  id: string;
  label: string;
  type:
    | "text"
    | "number"
    | "slider"
    | "boolean"
    | "select"
    | "textarea"
    | "code"
    | "color"
    | "className"
    | "custom";
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  readOnly?: boolean;
  options?: InspectorFieldOption[];
  value?: InspectorFieldValue;
  render?: (
    value: InspectorFieldValue,
    onChange: (value: InspectorFieldValue) => void,
  ) => React.ReactNode;
};

type InspectorPanelSectionData = {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  fields: InspectorFieldDefinition[];
};

type InspectorPanelProps = Omit<React.ComponentProps<"section">, "onChange" | "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  sections?: InspectorPanelSectionData[];
  fields?: InspectorFieldDefinition[];
  values?: Record<string, InspectorFieldValue>;
  defaultValues?: Record<string, InspectorFieldValue>;
  readOnly?: boolean;
  validationMessages?: Record<string, React.ReactNode>;
  onValuesChange?: (values: Record<string, InspectorFieldValue>, dirty: boolean) => void;
  onApply?: (values: Record<string, InspectorFieldValue>) => void;
  onReset?: () => void;
};

export type InspectorPanelHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  dirty?: boolean;
};

export type InspectorPanelSectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  defaultOpen?: boolean;
};

export type InspectorFieldProps = React.ComponentProps<"div"> & {
  field: InspectorFieldDefinition;
  value?: InspectorFieldValue;
  readOnly?: boolean;
  validationMessage?: React.ReactNode;
  onValueChange?: (value: InspectorFieldValue) => void;
};

export type InspectorFieldGroupProps = React.ComponentProps<"div">;

export type InspectorActionsProps = React.ComponentProps<"footer"> & {
  dirty?: boolean;
  readOnly?: boolean;
  onApply?: () => void;
  onReset?: () => void;
};

function InspectorPanel({
  title = "Inspector",
  description,
  sections,
  fields,
  values,
  defaultValues,
  readOnly = false,
  validationMessages,
  onValuesChange,
  onApply,
  onReset,
  className,
  ...props
}: InspectorPanelProps) {
  const normalizedSections = React.useMemo(
    () =>
      sections?.length
        ? sections
        : [
            {
              id: "properties",
              title: "Properties",
              defaultOpen: true,
              fields: fields ?? [],
            },
          ],
    [fields, sections],
  );
  const initialValues = React.useMemo(
    () => ({
      ...collectInspectorFieldValues(normalizedSections),
      ...defaultValues,
    }),
    [defaultValues, normalizedSections],
  );
  const [internalValues, setInternalValues] =
    React.useState<Record<string, InspectorFieldValue>>(initialValues);
  const currentValues = values ?? internalValues;
  const dirty = !areInspectorValuesEqual(currentValues, initialValues);

  React.useEffect(() => {
    if (values) {
      return;
    }
    setInternalValues((current) => ({ ...initialValues, ...current }));
  }, [initialValues, values]);

  const commitValue = (fieldId: string, value: InspectorFieldValue) => {
    const nextValues = { ...currentValues, [fieldId]: value };
    setInternalValues(nextValues);
    onValuesChange?.(nextValues, !areInspectorValuesEqual(nextValues, initialValues));
  };

  const resetValues = () => {
    setInternalValues(initialValues);
    onValuesChange?.(initialValues, false);
    onReset?.();
  };

  return (
    <EditorInspector
      data-read-only={readOnly ? "true" : undefined}
      className={cn("h-auto rounded-md border border-border/70", className)}
      {...props}
    >
      <InspectorPanelHeader title={title} description={description} dirty={dirty} />
      <EditorInspectorContent className="overflow-visible py-0">
        {normalizedSections.map((section) => (
          <InspectorPanelSection
            key={section.id}
            title={section.title}
            description={section.description}
            defaultOpen={section.defaultOpen ?? true}
          >
            <InspectorFieldGroup>
              {section.fields.map((field) => (
                <InspectorField
                  key={field.id}
                  field={field}
                  value={currentValues[field.id]}
                  readOnly={readOnly}
                  validationMessage={validationMessages?.[field.id]}
                  onValueChange={(value) => commitValue(field.id, value)}
                />
              ))}
            </InspectorFieldGroup>
          </InspectorPanelSection>
        ))}
      </EditorInspectorContent>
      <InspectorActions
        dirty={dirty}
        readOnly={readOnly}
        onApply={() => onApply?.(currentValues)}
        onReset={resetValues}
      />
    </EditorInspector>
  );
}

function InspectorPanelHeader({ title, description, dirty, ...props }: InspectorPanelHeaderProps) {
  return (
    <EditorInspectorHeader
      title={title}
      description={description}
      actions={dirty ? <Badge variant="secondary">Unsaved</Badge> : undefined}
      {...props}
    />
  );
}

function InspectorPanelSection({
  title,
  description,
  defaultOpen = true,
  children,
  ...props
}: InspectorPanelSectionProps) {
  return (
    <PropertySection
      title={title}
      description={description}
      collapsible
      defaultOpen={defaultOpen}
      {...props}
    >
      {children}
    </PropertySection>
  );
}

function InspectorFieldGroup({ className, ...props }: InspectorFieldGroupProps) {
  return (
    <div data-slot="inspector-field-group" className={cn("grid gap-3", className)} {...props} />
  );
}

function InspectorField({
  field,
  value,
  readOnly,
  validationMessage,
  onValueChange,
  ...props
}: InspectorFieldProps) {
  const disabled = readOnly || field.readOnly;
  const id = `inspector-${field.id}`;
  const descriptionId = field.description ? `${id}-description` : undefined;
  const validationId = validationMessage ? `${id}-validation` : undefined;
  const describedBy = [descriptionId, validationId].filter(Boolean).join(" ") || undefined;

  return (
    <PropertyRow
      data-field-id={field.id}
      label={field.label}
      // Custom controls name themselves; the label still points at a control using the field id.
      htmlFor={id}
      description={field.description}
      descriptionId={descriptionId}
      validationMessage={validationMessage}
      validationId={validationId}
      orientation="vertical"
      {...props}
    >
      <InspectorFieldEditor
        field={field}
        value={value}
        disabled={disabled}
        describedBy={describedBy}
        invalid={Boolean(validationMessage)}
        onValueChange={onValueChange}
      />
    </PropertyRow>
  );
}

function InspectorFieldEditor({
  field,
  value,
  disabled,
  describedBy,
  invalid,
  onValueChange,
}: {
  field: InspectorFieldDefinition;
  value?: InspectorFieldValue;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
  onValueChange?: (value: InspectorFieldValue) => void;
}) {
  const id = `inspector-${field.id}`;
  const described = {
    "aria-describedby": describedBy,
    "aria-invalid": invalid ? true : undefined,
  } as const;

  if (field.type === "custom") {
    return <>{field.render?.(value, (nextValue) => !disabled && onValueChange?.(nextValue))}</>;
  }

  if (field.type === "boolean") {
    return (
      <label className="flex h-8 items-center gap-2 rounded-md border px-2 text-sm">
        <Checkbox
          id={id}
          {...described}
          checked={Boolean(value)}
          disabled={disabled}
          onCheckedChange={(checked) => onValueChange?.(checked === true)}
        />
        Enabled
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <SelectDropdown
        id={id}
        aria-label={field.label}
        {...described}
        value={String(value ?? "")}
        disabled={disabled}
        onValueChange={(nextValue) => onValueChange?.(nextValue)}
        options={(field.options ?? []).map((option) => ({
          label: option.label,
          value: String(option.value),
        }))}
      />
    );
  }

  if (field.type === "slider") {
    const numericValue = typeof value === "number" ? value : Number(value ?? field.min ?? 0);

    return (
      <div className="flex items-center gap-3">
        <Slider
          id={id}
          aria-label={field.label}
          {...described}
          value={[Number.isFinite(numericValue) ? numericValue : (field.min ?? 0)]}
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          disabled={disabled}
          onValueChange={(values) => onValueChange?.(values[0] ?? field.min ?? 0)}
        />
        <Input
          aria-label={`${field.label} value`}
          type="number"
          value={String(Number.isFinite(numericValue) ? numericValue : (field.min ?? 0))}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          className="h-8 w-20"
          onChange={(event) => onValueChange?.(Number(event.currentTarget.value))}
        />
      </div>
    );
  }

  if (field.type === "color") {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          aria-label={field.label}
          {...described}
          type="color"
          value={String(value || "#000000")}
          disabled={disabled}
          className="h-8 w-12 shrink-0 p-1"
          onChange={(event) => onValueChange?.(event.currentTarget.value)}
        />
        <Input
          aria-label={`${field.label} color value`}
          value={String(value ?? "")}
          disabled={disabled}
          placeholder={field.placeholder ?? "#000000"}
          className="font-mono text-xs"
          onChange={(event) => onValueChange?.(event.currentTarget.value)}
        />
      </div>
    );
  }

  if (field.type === "textarea" || field.type === "code") {
    return (
      <Textarea
        id={id}
        aria-label={field.label}
        {...described}
        value={String(value ?? "")}
        disabled={disabled}
        placeholder={field.placeholder}
        className={cn(field.type === "code" && "font-mono text-xs")}
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
      />
    );
  }

  if (field.type === "className") {
    return (
      <Textarea
        id={id}
        aria-label={field.label}
        {...described}
        value={String(value ?? "")}
        disabled={disabled}
        placeholder={field.placeholder ?? "rounded-md border-border/60"}
        className="min-h-20 font-mono text-xs"
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
      />
    );
  }

  return (
    <Input
      id={id}
      aria-label={field.label}
      {...described}
      type={field.type === "number" ? "number" : "text"}
      value={String(value ?? "")}
      disabled={disabled}
      placeholder={field.placeholder}
      onChange={(event) =>
        onValueChange?.(
          // A cleared number field stays empty instead of silently becoming 0.
          field.type === "number" && event.currentTarget.value !== ""
            ? Number(event.currentTarget.value)
            : event.currentTarget.value,
        )
      }
    />
  );
}

function InspectorActions({
  dirty,
  readOnly,
  onApply,
  onReset,
  className,
  ...props
}: InspectorActionsProps) {
  return (
    <EditorInspectorFooter className={cn("sticky bottom-0 z-10 bg-card", className)} {...props}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={readOnly || !dirty}
        onClick={onReset}
      >
        <RotateCcwIcon />
        Reset
      </Button>
      <Button type="button" size="sm" disabled={readOnly || !dirty} onClick={onApply}>
        <CheckIcon />
        Apply
      </Button>
    </EditorInspectorFooter>
  );
}

function collectInspectorFieldValues(sections: InspectorPanelSectionData[]) {
  return sections.reduce<Record<string, InspectorFieldValue>>((values, section) => {
    for (const field of section.fields) {
      values[field.id] = field.value;
    }
    return values;
  }, {});
}

function areInspectorValuesEqual(
  left: Record<string, InspectorFieldValue>,
  right: Record<string, InspectorFieldValue>,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export {
  InspectorActions,
  InspectorField,
  InspectorFieldGroup,
  InspectorPanel,
  InspectorPanelHeader,
  InspectorPanelSection,
};
export type {
  InspectorFieldDefinition,
  InspectorFieldOption,
  InspectorFieldValue,
  InspectorPanelProps,
  InspectorPanelSectionData,
};
