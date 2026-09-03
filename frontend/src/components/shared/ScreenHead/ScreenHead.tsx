import { cn } from "@/lib/utils";

const uniqueId = "1fab9670-bf8a-4987-bdbe-5f60075ab092";

export const DATA_TEST_ID = {
  CONTAINER: `screen-head-container-${uniqueId}`,
  EYEBROW: `screen-head-eyebrow-${uniqueId}`,
  TITLE: `screen-head-title-${uniqueId}`,
  DESCRIPTION: `screen-head-description-${uniqueId}`,
};

export interface ScreenHeadProps {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
}

export function ScreenHead({ title, eyebrow, description, className }: Readonly<ScreenHeadProps>) {
  return (
    <header data-slot="screen-head" data-testid={DATA_TEST_ID.CONTAINER} className={cn("grid gap-2", className)}>
      {eyebrow && (
        <p
          data-slot="screen-head-eyebrow"
          data-testid={DATA_TEST_ID.EYEBROW}
          className="font-mono text-xs tracking-[2px] text-green-3 uppercase"
        >
          {eyebrow}
        </p>
      )}
      <h1
        data-slot="screen-head-title"
        data-testid={DATA_TEST_ID.TITLE}
        className="text-3xl font-bold tracking-tight text-foreground"
      >
        {title}
      </h1>
      {description && (
        <p
          data-slot="screen-head-description"
          data-testid={DATA_TEST_ID.DESCRIPTION}
          className="max-w-(--measure) text-muted-foreground text-[15px]"
        >
          {description}
        </p>
      )}
    </header>
  );
}
