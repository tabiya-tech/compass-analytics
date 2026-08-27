import { MODULE_IDS } from "@/access/AccessContext";
import { percentageOf } from "@/components/charts/chart-scale";
import type { BuildYourProfileResponse } from "@/analytics/analytics.types";
import { BUILD_YOUR_PROFILE_TARGET_MINUTES, type ConversationPhaseId } from "@/pages/Modules/types";
import type {
  BuildYourProfileMetrics,
  CareerExplorerMetrics,
  JobReadinessMetrics,
  JobsMetrics,
} from "@/pages/Modules/types";

export function mapBuildYourProfileResponse(response: BuildYourProfileResponse): BuildYourProfileMetrics {
  const { summary } = response;
  return {
    moduleId: MODULE_IDS.BUILD_YOUR_PROFILE,
    startedPercentage: Math.round(summary.started_percentage),
    cvsGenerated: summary.completed_users,
    cvsGeneratedSharePercentage: percentageOf(summary.completed_users, summary.started_users),
    averageMinutesToComplete: summary.avg_completion_minutes,
    targetMinutes: BUILD_YOUR_PROFILE_TARGET_MINUTES,
    phases: response.phases.map((phase) => ({ id: phase.id as ConversationPhaseId, reached: phase.reached })),
    degraded: response.degraded,
  };
}

export function unavailableBuildYourProfile(): BuildYourProfileMetrics {
  return mapBuildYourProfileResponse({
    summary: { started_users: 0, started_percentage: 0, completed_users: 0, avg_completion_minutes: 0 },
    series: [],
    phases: [],
    degraded: true,
  });
}

export function unavailableJobReadiness(): JobReadinessMetrics {
  return { moduleId: MODULE_IDS.JOB_READINESS, startedPercentage: 0, subModules: [] };
}

export function unavailableCareerExplorer(): CareerExplorerMetrics {
  return { moduleId: MODULE_IDS.CAREER_EXPLORER, startedPercentage: 0, topSectors: [] };
}

export function unavailableJobs(): JobsMetrics {
  return {
    moduleId: MODULE_IDS.JOBS,
    startedPercentage: 0,
    jobsSourced: 0,
    profilesWithMatches: 0,
    profilesWithMatchesSharePercentage: 0,
    jobsViewedPerUser: 0,
    topCategories: [],
    degraded: false,
  };
}
