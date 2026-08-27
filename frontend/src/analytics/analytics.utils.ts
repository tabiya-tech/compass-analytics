import type { RequestedInstitutions } from "@/pages/Overview/overview.types";

/** `all`, or a comma-separated list of ids — one param either way. */
export function serializeInstitutions(institutions: RequestedInstitutions): string {
  return institutions === "all" ? "all" : institutions.join(",");
}
