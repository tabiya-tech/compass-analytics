import { useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Clock, Sparkles, TriangleAlert, X } from "lucide-react";
import { useAccess } from "@/access/AccessContext";
import { CompletionRing } from "@/components/shared/CompletionRing";
import { EmptyState } from "@/components/shared/EmptyState";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobseekerDetail } from "@/jobseekers/jobseekers.types";
import type { JobseekerDetailState } from "@/pages/JobSeekers/hooks/useJobseekerDetail";
import { NO_VALUE, formatDay } from "@/pages/JobSeekers/utils";
import { ModuleProgressList } from "./components/ModuleProgressList";
import { cn } from "@/lib/utils";

const uniqueId = "d43f97b0-1e58-4c26-b0af-72956ce8134d";

export const DATA_TEST_ID = {
  CONTAINER: `profile-modal-container-${uniqueId}`,
  BODY: `profile-modal-body-${uniqueId}`,
  CLOSE: `profile-modal-close-${uniqueId}`,
  HEADER: `profile-modal-header-${uniqueId}`,
  IDENTITY: `profile-modal-identity-${uniqueId}`,
  LOGIN_ACTIVITY: `profile-modal-login-activity-${uniqueId}`,
  PROGRESS: `profile-modal-progress-${uniqueId}`,
  OUTPUTS: `profile-modal-outputs-${uniqueId}`,
  SKILLS: `profile-modal-skills-${uniqueId}`,
  VIEW_SKILLS: `profile-modal-view-skills-${uniqueId}`,
  LOADING: `profile-modal-loading-${uniqueId}`,
  ERROR: `profile-modal-error-${uniqueId}`,
};

export interface ProfileModalProps {
  open: boolean;
  state: JobseekerDetailState;
  onOpenChange: (open: boolean) => void;
  onViewSkills: (detail: JobseekerDetail) => void;
}

function Panel({
  title,
  description,
  testId,
  children,
}: Readonly<{ title: string; description?: string; testId?: string; children: ReactNode }>) {
  return (
    <section data-testid={testId} className="grid content-start gap-5 rounded-card bg-card p-6 shadow-sm">
      <div className="grid gap-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function StatRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm not-last:border-b not-last:pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function OutputRow({
  label,
  done,
  doneLabel,
  pendingLabel,
}: Readonly<{ label: string; done: boolean; doneLabel: string; pendingLabel: string }>) {
  const Icon = done ? Check : Clock;
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm not-last:border-b not-last:pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("flex items-center gap-1.5 font-semibold", done ? "text-green-3" : "text-muted-foreground")}>
        <Icon aria-hidden="true" className="size-4" />
        {done ? doneLabel : pendingLabel}
      </dd>
    </div>
  );
}

function DetailBody({ detail, onViewSkills }: Readonly<{ detail: JobseekerDetail; onViewSkills: () => void }>) {
  const { t } = useTranslation();
  const { activeModules } = useAccess();
  const { demographics, login_activity: login, outputs } = detail;

  // The endpoint reports every module; only the ones this deployment runs are meaningful here.
  const modules = useMemo(
    () => detail.modules.filter((module) => activeModules.includes(module.module_id)),
    [detail.modules, activeModules]
  );

  return (
    <div className="grid gap-4">
      <section
        data-testid={DATA_TEST_ID.HEADER}
        className="flex flex-wrap items-center gap-4 rounded-card bg-card p-6 shadow-sm"
      >
        <UserAvatar name={detail.name} size="lg" />
        <div className="grid min-w-0 gap-1">
          <DialogTitle className="text-2xl font-bold tracking-tight">{detail.name}</DialogTitle>
          <DialogDescription className="font-mono text-sm tracking-[1px]">
            {t("jobseekers.profileModal.subtitle", { id: detail.id, institution: detail.institution_name })}
          </DialogDescription>
        </div>
        <div className="ml-auto grid justify-items-center gap-1">
          <CompletionRing value={detail.profile_score_pct} label={String(detail.profile_score_pct)} />
          <p className="font-mono text-xs tracking-[2px] text-muted-foreground uppercase">
            {t("jobseekers.profileModal.profileScore")}
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t("jobseekers.profileModal.identity.title")} testId={DATA_TEST_ID.IDENTITY}>
          <dl className="grid gap-3">
            {/* Anything they have not told us reads as a dash, not a blank row. */}
            <StatRow label={t("jobseekers.profileModal.identity.gender")} value={demographics.gender ?? NO_VALUE} />
            <StatRow
              label={t("jobseekers.profileModal.identity.age")}
              value={demographics.age === null ? NO_VALUE : String(demographics.age)}
            />
            <StatRow label={t("jobseekers.profileModal.identity.location")} value={demographics.location ?? NO_VALUE} />
            <StatRow
              label={t("jobseekers.profileModal.identity.education")}
              value={demographics.education ?? NO_VALUE}
            />
          </dl>
        </Panel>

        <Panel title={t("jobseekers.profileModal.login.title")} testId={DATA_TEST_ID.LOGIN_ACTIVITY}>
          <dl className="grid gap-3">
            <StatRow label={t("jobseekers.profileModal.login.registered")} value={formatDay(login.registered_at)} />
            <StatRow label={t("jobseekers.profileModal.login.lastLogin")} value={formatDay(login.last_login_at)} />
            <StatRow
              label={t("jobseekers.profileModal.login.totalLogins")}
              value={login.total_logins.toLocaleString()}
            />
            <StatRow
              label={t("jobseekers.profileModal.login.method")}
              value={login.login_method ? t(`filters.loginMethods.${login.login_method}`) : NO_VALUE}
            />
          </dl>
        </Panel>
      </div>

      <Panel
        title={t("jobseekers.profileModal.progress.title")}
        description={t("jobseekers.profileModal.progress.description")}
        testId={DATA_TEST_ID.PROGRESS}
      >
        <ModuleProgressList modules={modules} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t("jobseekers.profileModal.outputs.title")} testId={DATA_TEST_ID.OUTPUTS}>
          <dl className="grid gap-3">
            {(
              [
                ["jobseekers.profileModal.outputs.generated", outputs.skills_report_generated],
                ["jobseekers.profileModal.outputs.downloaded", outputs.downloaded],
                ["jobseekers.profileModal.outputs.shared", outputs.shared],
              ] as const
            ).map(([labelKey, done]) => (
              <OutputRow
                key={labelKey}
                label={t(labelKey)}
                done={done}
                doneLabel={t("common.yes")}
                pendingLabel={t("common.no")}
              />
            ))}
          </dl>
        </Panel>

        <Panel title={t("jobseekers.profileModal.skills.title")} testId={DATA_TEST_ID.SKILLS}>
          {detail.skills.length > 0 ? (
            <div className="grid justify-items-start gap-4">
              <p className="text-sm text-muted-foreground">
                {t("jobseekers.profileModal.skills.captured", { value: detail.skills.length })}
              </p>
              <Button
                aria-haspopup="dialog"
                onClick={onViewSkills}
                data-testid={DATA_TEST_ID.VIEW_SKILLS}
                className="rounded-pill"
              >
                <Sparkles aria-hidden="true" />
                {t("jobseekers.profileModal.skills.viewAll")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("jobseekers.profileModal.skills.notReady")}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/**
 * The full activity trail for one jobseeker.
 *
 * FOLLOW-UP (needs a backend + a consent system): opening a named person's profile must also be
 * gated on that person's explicit consent to being identified, independently of the operator's
 * `jobseekers:view` grant. Until such a system exists this modal renders whatever the endpoint
 * returns, which the mocked roster limits to jobseekers treated as having consented.
 */
export function ProfileModal({ open, state, onOpenChange, onViewSkills }: Readonly<ProfileModalProps>) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Focus the dialog itself, not the close control, which would open showing its focus ring. */}
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        data-testid={DATA_TEST_ID.CONTAINER}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden bg-[#fcfbf8] p-0 shadow-(--shadow-lg) outline-none sm:max-w-3xl"
      >
        {/* The body scrolls, not the dialog. The close control sits inside it, pinned by an opaque
            strip, so it stays reachable and the panels scroll behind it rather than under it. */}
        <div data-testid={DATA_TEST_ID.BODY} className="min-h-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex justify-end bg-[#fcfbf8] px-4 pt-2 pb-1 sm:px-6">
            <DialogClose
              data-testid={DATA_TEST_ID.CLOSE}
              className="rounded-full bg-muted p-2 text-foreground/70 transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">{t("common.close")}</span>
            </DialogClose>
          </div>

          <div className="px-4 pb-6 sm:px-6 sm:pb-8">
            {state.status === "success" ? (
              <DetailBody detail={state.data} onViewSkills={() => onViewSkills(state.data)} />
            ) : (
              // The dialog needs a name before its content arrives, hence the sr-only title.
              <div className="grid gap-2">
                <DialogTitle className="sr-only">{t("jobseekers.profileModal.title")}</DialogTitle>
                {state.status === "error" && (
                  <div data-testid={DATA_TEST_ID.ERROR}>
                    <EmptyState
                      icon={<TriangleAlert />}
                      message={t("jobseekers.profileModal.error")}
                      action={{ label: t("common.retry"), onClick: state.retry }}
                    />
                  </div>
                )}
                {/* Idle means it is fading out after a close — a skeleton would flash there. */}
                {state.status === "loading" && (
                  <div role="status" aria-busy="true" data-testid={DATA_TEST_ID.LOADING} className="grid gap-4">
                    <span className="sr-only">{t("common.loading")}</span>
                    <Skeleton aria-hidden="true" className="h-[136px] rounded-card" />
                    <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
                      <Skeleton className="h-[236px] rounded-card" />
                      <Skeleton className="h-[236px] rounded-card" />
                    </div>
                    <Skeleton aria-hidden="true" className="h-[260px] rounded-card" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
