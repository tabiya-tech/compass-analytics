import { useMemo } from "react";
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

// Sorted alphabetically for the funder choosing between them.
export function useInstitutionChoices(): InstitutionChoicesState {
  const state = useInstitutions();

  return useMemo(() => {
    if (state.status !== "success") return state;
    const items = [...state.data.items]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name }) => ({ id, name }));
    return { status: "success", items };
  }, [state]);
}
