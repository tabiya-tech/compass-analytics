import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Building2, TriangleAlert, X } from "lucide-react";
import { CompletionRing } from "@/components/shared/CompletionRing";
import { EmptyState } from "@/components/shared/EmptyState";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { InstitutionDetail } from "@/institutions/institutions.types";
import type { InstitutionDetailState } from "@/pages/Institutions/hooks/useInstitutionDetail";
import { ModuleProgress } from "./components/ModuleProgress";

const uniqueId = "5d8b2f47-6a91-4c03-b7e2-9f4a1c60d385";

export const DATA_TEST_ID = {
  CONTAINER: `institution-modal-container-${uniqueId}`,
  BODY: `institution-modal-body-${uniqueId}`,
  CLOSE: `institution-modal-close-${uniqueId}`,
  HEADER: `institution-modal-header-${uniqueId}`,
  REACH: `institution-modal-reach-${uniqueId}`,
  LOGIN_ACTIVITY: `institution-modal-login-activity-${uniqueId}`,
  PROGRESS: `institution-modal-progress-${uniqueId}`,
  OUTPUTS: `institution-modal-outputs-${uniqueId}`,
  TIME_TO_COMPLETE: `institution-modal-time-to-complete-${uniqueId}`,
  LOADING: `institution-modal-loading-${uniqueId}`,
  ERROR: `institution-modal-error-${uniqueId}`,
};

export interface InstitutionModalProps {
  open: boolean;
  state: InstitutionDetailState;
  onOpenChange: (open: boolean) => void;
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

function DetailBody({ detail }: Readonly<{ detail: InstitutionDetail }>) {
  const { t } = useTranslation();
  const { reach, login_activity: login, outputs } = detail;

  return (
    <div className="grid gap-4">
      <section
        data-testid={DATA_TEST_ID.HEADER}
        className="flex flex-wrap items-center gap-4 rounded-card bg-card p-6 shadow-sm"
      >
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-tabiya-blue text-tabiya-green"
        >
          <Building2 className="size-6" />
        </span>
        <div className="grid min-w-0 gap-1">
          <DialogTitle className="text-2xl font-bold tracking-tight">{detail.name}</DialogTitle>
          <DialogDescription className="font-mono text-sm tracking-[1px]">
            {t("institutions.modal.subtitle", {
              city: detail.city,
              region: detail.region,
              lead: detail.lead_pm,
            })}
          </DialogDescription>
        </div>
        {detail.profile_score_pct !== undefined && (
          <div className="ml-auto grid justify-items-center gap-1">
            <CompletionRing value={detail.profile_score_pct} label={String(detail.profile_score_pct)} />
            <p className="font-mono text-xs tracking-[2px] text-muted-foreground uppercase">
              {t("institutions.modal.profileScore")}
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t("institutions.modal.reach.title")} testId={DATA_TEST_ID.REACH}>
          <dl className="grid gap-3">
            <StatRow
              label={t("institutions.modal.reach.registeredUsers")}
              value={reach.registered_users.toLocaleString()}
            />
            <StatRow
              label={t("institutions.modal.reach.activeUsers")}
              value={reach.active_users_30d.toLocaleString()}
            />
            <StatRow label={t("institutions.modal.reach.topAgeBand")} value={reach.top_age_band} />
            <StatRow label={t("institutions.modal.reach.largestGroup")} value={reach.largest_group} />
            <StatRow label={t("institutions.modal.reach.education")} value={reach.most_common_education} />
          </dl>
        </Panel>

        <Panel title={t("institutions.modal.login.title")} testId={DATA_TEST_ID.LOGIN_ACTIVITY}>
          <dl className="grid gap-3">
            <StatRow label={t("institutions.modal.login.avgLogins")} value={login.avg_logins_per_user.toFixed(1)} />
            <StatRow label={t("institutions.modal.login.totalLogins")} value={login.total_logins.toLocaleString()} />
            <StatRow
              label={t("institutions.modal.login.avgSession")}
              value={t("institutions.modal.login.minutes", { value: login.avg_session_minutes })}
            />
            <StatRow label={t("institutions.modal.login.google")} value={`${login.google_login_pct}%`} />
            <StatRow label={t("institutions.modal.login.email")} value={`${login.email_login_pct}%`} />
          </dl>
        </Panel>
      </div>

      <Panel
        title={t("institutions.modal.progress.title")}
        description={t("institutions.modal.progress.description")}
        testId={DATA_TEST_ID.PROGRESS}
      >
        <ModuleProgress modules={detail.modules} />
      </Panel>

      {/* Both panels report Build Your Profile figures — no BYP, no panels. */}
      {outputs && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={t("institutions.modal.outputs.title")} testId={DATA_TEST_ID.OUTPUTS}>
            <dl className="grid gap-3">
              <StatRow
                label={t("institutions.modal.outputs.skillsReports")}
                value={outputs.skills_reports_generated.toLocaleString()}
              />
              <StatRow label={t("institutions.modal.outputs.downloaded")} value={outputs.downloaded.toLocaleString()} />
              <StatRow
                label={t("institutions.modal.outputs.jobsSourced")}
                value={outputs.jobs_sourced.toLocaleString()}
              />
            </dl>
          </Panel>

          <Panel title={t("institutions.modal.time.title")} testId={DATA_TEST_ID.TIME_TO_COMPLETE}>
            <p className="text-4xl font-bold tracking-tight text-foreground">
              {outputs.avg_time_to_complete_minutes.toFixed(1)}
              <span className="ml-1 text-lg font-medium text-muted-foreground">
                {t("institutions.modal.time.unit")}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("institutions.modal.time.caption", { target: outputs.target_minutes })}
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}

export function InstitutionModal({ open, state, onOpenChange }: Readonly<InstitutionModalProps>) {
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
              <DetailBody detail={state.data} />
            ) : (
              // The dialog needs a name before its content arrives, hence the sr-only title.
              <div className="grid gap-2">
                <DialogTitle className="sr-only">{t("institutions.modal.title")}</DialogTitle>
                {state.status === "error" && (
                  <div data-testid={DATA_TEST_ID.ERROR}>
                    <EmptyState
                      icon={<TriangleAlert />}
                      message={t("institutions.modal.error")}
                      action={{ label: t("common.retry"), onClick: state.retry }}
                    />
                  </div>
                )}
                {/* Idle means it is fading out after a close — a skeleton would flash there. */}
                {state.status === "loading" && (
                  <div role="status" aria-busy="true" data-testid={DATA_TEST_ID.LOADING} className="grid gap-4">
                    <span className="sr-only">{t("common.loading")}</span>
                    <Skeleton aria-hidden="true" className="h-[116px] rounded-card" />
                    <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
                      <Skeleton className="h-[264px] rounded-card" />
                      <Skeleton className="h-[264px] rounded-card" />
                    </div>
                    <Skeleton aria-hidden="true" className="h-[220px] rounded-card" />
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
