import { useReach } from "@/pages/Overview/useReach";

const uniqueId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const DATA_TEST_ID = {
  CONTAINER: `overview-container-${uniqueId}`,
  REACH_SUMMARY: `overview-reach-summary-${uniqueId}`,
  REACH_ERROR: `overview-reach-error-${uniqueId}`,
  REACH_LOADING: `overview-reach-loading-${uniqueId}`,
};

function ReachSummaryCard({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function Overview() {
  const reach = useReach();

  return (
    <div className="flex flex-col gap-6 p-6" data-testid={DATA_TEST_ID.CONTAINER}>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>

      {reach.status === "loading" && (
        <p className="text-muted-foreground" data-testid={DATA_TEST_ID.REACH_LOADING}>
          Loading…
        </p>
      )}

      {reach.status === "error" && (
        <p className="text-destructive" data-testid={DATA_TEST_ID.REACH_ERROR}>
          {reach.message}
        </p>
      )}

      {reach.status === "success" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-testid={DATA_TEST_ID.REACH_SUMMARY}>
          <ReachSummaryCard label="Total Users" value={reach.data.summary.total_users.toLocaleString()} />
          <ReachSummaryCard label="Active (30d)" value={reach.data.summary.active_users_30d.toLocaleString()} />
          <ReachSummaryCard label="Total Logins" value={reach.data.summary.total_logins.toLocaleString()} />
          <ReachSummaryCard label="Avg Logins / User" value={reach.data.summary.avg_logins_per_user.toFixed(1)} />
          <ReachSummaryCard label="Avg Session (min)" value={reach.data.summary.avg_session_minutes} />
        </div>
      )}
    </div>
  );
}
