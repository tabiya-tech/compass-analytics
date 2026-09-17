import type { components, paths } from "./schema";

// Re-marks fields Pydantic's default_factory idiom left falsely-optional in the schema.
// Only for fields confirmed to use default_factory, not genuinely optional ones.
type RequiredDefaultFactoryFields<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// ---- Response / request body schemas: 1:1 with the backend's OpenAPI component schemas. ----

export type JobseekerSummary = RequiredDefaultFactoryFields<
  components["schemas"]["JobseekerSummary"],
  "module_status" | "skills"
>;
export type JobseekerSubModuleProgress = components["schemas"]["JobseekerSubModuleProgress"];
export type JobseekerModuleProgress = components["schemas"]["JobseekerModuleProgress"];
export type JobseekerDemographics = components["schemas"]["JobseekerDemographics"];
export type JobseekerLoginActivity = components["schemas"]["JobseekerLoginActivity"];
export type JobseekerOutputs = components["schemas"]["JobseekerOutputs"];
export type JobseekerDetail = RequiredDefaultFactoryFields<
  components["schemas"]["JobseekerDetail"],
  "modules" | "skills"
>;
export type JobseekersResponse = Omit<components["schemas"]["JobseekersResponse"], "items"> & {
  items: JobseekerSummary[];
};

// Renamed from the spec's InstitutionItem to InstitutionSummary since every frontend call
// site already uses that name and the shapes are identical.
export type InstitutionSummary = components["schemas"]["InstitutionItem"];
export type InstitutionsTotals = components["schemas"]["InstitutionsTotals"];
export type InstitutionReach = components["schemas"]["InstitutionReach"];
export type InstitutionLoginActivity = components["schemas"]["InstitutionLoginActivity"];
export type InstitutionModuleProgress = components["schemas"]["InstitutionModuleProgress"];
export type InstitutionDetail = components["schemas"]["InstitutionDetail"];
export type InstitutionsResponse = components["schemas"]["InstitutionsResponse"];

export type UserScope = components["schemas"]["UserScope"];
export type PermissionEntry = components["schemas"]["PermissionEntry"];
export type RoleRecord = components["schemas"]["RoleRecord"];
export type UserRoleView = components["schemas"]["UserRoleView"];
export type MeResponse = RequiredDefaultFactoryFields<
  components["schemas"]["MeResponse"],
  "permissions" | "active_modules"
>;
export type ManagedUser = RequiredDefaultFactoryFields<components["schemas"]["ManagedUser"], "roles">;
export type AssignRoleRequest = components["schemas"]["AssignRoleRequest"];
export type UserRegisterRequest = components["schemas"]["RegisterRequest"];

export type ReachSummary = components["schemas"]["ReachSummary"];
export type TimeSeriesPoint = components["schemas"]["TimeSeriesPoint"];
export type ReachResponse = components["schemas"]["ReachResponse"];
export type BuildYourProfileSummary = components["schemas"]["BuildYourProfileSummary"];
export type BuildYourProfileSeriesPoint = components["schemas"]["BuildYourProfileSeriesPoint"];
export type ConversationPhaseReach = components["schemas"]["ConversationPhaseReach"];
export type BuildYourProfileResponse = components["schemas"]["BuildYourProfileResponse"];
export type SubModuleProgress = components["schemas"]["SubModuleProgress"];
export type JobReadinessResponse = components["schemas"]["JobReadinessResponse"];
export type JobsSummary = components["schemas"]["JobsSummary"];
export type JobsResponse = components["schemas"]["JobsResponse"];
export type CareerExplorerSector = components["schemas"]["CareerExplorerSector"];
export type CareerExplorerSummary = components["schemas"]["CareerExplorerSummary"];
export type CareerExplorerResponse = components["schemas"]["CareerExplorerResponse"];
export type DemographicItem = components["schemas"]["DemographicItem"];
export type DemographicChart = components["schemas"]["DemographicChart"];
export type DemographicsResponse = components["schemas"]["DemographicsResponse"];

// ---- Individual query-parameter types: these endpoints take separate query parameters, not
// one JSON body. Below, richer frontend shapes (jobseekers' filters, institutions' sort/search)
// alias only the field vocabulary; encoding to the wire format stays a plain function. --------

export type AnalyticsParams = paths["/api/reach"]["get"]["parameters"]["query"];
export type DemographicsParams = paths["/api/demographics"]["get"]["parameters"]["query"];

type JobseekersQueryParams = NonNullable<paths["/api/jobseekers"]["get"]["parameters"]["query"]>;
export type JobseekerSortKey = NonNullable<JobseekersQueryParams["sort_by"]>;
export type JobseekerSortDirection = NonNullable<JobseekersQueryParams["sort_dir"]>;

export type AnalyticsGranularity = AnalyticsParams["granularity"];
export type ReachAudienceSegment = NonNullable<AnalyticsParams["audience_segment"]>;
export type ReachLoginMethod = NonNullable<AnalyticsParams["login_method"]>;

export type JobseekerLoginMethod = NonNullable<JobseekerLoginActivity["login_method"]>;

export type DemographicChartType = DemographicChart["type"];

export type ModuleId = JobseekerModuleProgress["module_id"];

export type ModuleStatus = JobseekerModuleProgress["status"];
