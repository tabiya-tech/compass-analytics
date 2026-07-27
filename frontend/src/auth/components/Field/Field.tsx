import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const uniqueId = "5b8e2f14-9c3a-4d67-8f21-6a0b7c1d2e3f";

export const DATA_TEST_ID = {
  FIELD_CONTAINER: `auth-field-container-${uniqueId}`,
  FIELD_ERROR: `auth-field-error-${uniqueId}`,
};

export interface FieldProps extends React.ComponentProps<"input"> {
  label: string;
  icon?: ReactNode;
  error?: string;
  labelHidden?: boolean;
}

export function Field({ id, label, icon, error, labelHidden = true, className, ...inputProps }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="grid gap-1.5" data-testid={DATA_TEST_ID.FIELD_CONTAINER}>
      <Label htmlFor={fieldId} className={cn(labelHidden && "sr-only")}>
        {label}
      </Label>
      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted-foreground [&_svg]:size-5"
          >
            {icon}
          </span>
        )}
        <Input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 rounded-card border-border bg-card text-base shadow-sm placeholder:text-gray-400",
            "focus-visible:border-tabiya-green/50 focus-visible:ring-2 focus-visible:ring-tabiya-green/15",
            icon && "pl-12",
            className
          )}
          {...inputProps}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" data-testid={DATA_TEST_ID.FIELD_ERROR} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
