import { useMemo } from "react";
import type { InstitutionsQuery } from "@/institutions/institutions.types";
import { useInstitutions } from "@/pages/Institutions/hooks/useInstitutions";

/** One institution a role can be scoped to: the id the grant carries, and the name shown for it. */
export interface InstitutionChoice {
  id: string;
  name: string;
}

export type InstitutionChoicesState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "success"; items: readonly InstitutionChoice[] };

/**
 * The picker lists the whole deployment at once rather than paging through it, so ask for a page
 * big enough to hold it. Module-level so the reference is stable — the fetch keys off the query.
 */
const PICKER_QUERY: InstitutionsQuery = {
  sort: { by: "name", direction: "asc" },
  page: 1,
  page_size: 500,
};

/** The institutions a role can be scoped to, named for the funder choosing between them. */
export function useInstitutionChoices(): InstitutionChoicesState {
  const state = useInstitutions(PICKER_QUERY);

  return useMemo(() => {
    if (state.status !== "success") return state;
    return { status: "success", items: state.data.items.map(({ id, name }) => ({ id, name })) };
  }, [state]);
}
