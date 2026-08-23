import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const uniqueId = "c1704a6d-52b8-4f93-8e07-6d9315ba2c48";

export const DATA_TEST_ID = {
  CONTAINER: `skills-modal-container-${uniqueId}`,
  CLOSE: `skills-modal-close-${uniqueId}`,
  LIST: `skills-modal-list-${uniqueId}`,
  SKILL: `skills-modal-skill-${uniqueId}`,
  EMPTY: `skills-modal-empty-${uniqueId}`,
};

export interface SkillsModalProps {
  open: boolean;
  /** Null between closing and the exit animation finishing — the dialog keeps its last contents. */
  name: string | null;
  skills: readonly string[];
  onOpenChange: (open: boolean) => void;
}

/** The skills Build Your Profile elicited, as the Skills Report lists them. */
export function SkillsModal({ open, name, skills, onOpenChange }: Readonly<SkillsModalProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid={DATA_TEST_ID.CONTAINER}
        className="flex max-h-[84vh] flex-col gap-0 overflow-hidden p-0 shadow-(--shadow-lg) sm:max-w-lg"
      >
        <div className="flex items-center gap-3 border-b p-5">
          {name && <UserAvatar name={name} />}
          <div className="grid min-w-0 flex-1 gap-0.5">
            <DialogTitle className="truncate text-base font-bold">{name ?? ""}</DialogTitle>
            <DialogDescription className="font-mono text-xs tracking-[1px]">
              {t("jobseekers.skillsModal.subtitle", { value: skills.length })}
            </DialogDescription>
          </div>
          <DialogClose
            data-testid={DATA_TEST_ID.CLOSE}
            className="rounded-full bg-muted p-2 text-foreground/70 transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("common.close")}</span>
          </DialogClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {skills.length === 0 ? (
            <div data-testid={DATA_TEST_ID.EMPTY}>
              <EmptyState icon={<Sparkles />} message={t("jobseekers.skillsModal.notReady")} />
            </div>
          ) : (
            <ul data-testid={DATA_TEST_ID.LIST} className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li key={skill}>
                  <Badge
                    variant="secondary"
                    data-testid={DATA_TEST_ID.SKILL}
                    className="bg-light-green px-4 py-2 text-sm font-medium text-foreground"
                  >
                    {skill}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
