import { useState } from "react";

const FIRST_PAGE = 1;

export interface UsePaginationOptions {
  listIdentity: string;
  pageCount: number;
}

export interface PaginationState {
  page: number;
  setPage: (page: number) => void;
}

export function usePagination({ listIdentity, pageCount }: UsePaginationOptions): PaginationState {
  const [page, setPage] = useState(FIRST_PAGE);
  const [previousListIdentity, setPreviousListIdentity] = useState(listIdentity);

  const isListRenumbered = previousListIdentity !== listIdentity;
  const lastReachablePage = Math.max(FIRST_PAGE, pageCount);
  const isPastLastReachablePage = page > lastReachablePage;

  if (isListRenumbered) {
    setPreviousListIdentity(listIdentity);
    setPage(FIRST_PAGE);
  } else if (isPastLastReachablePage) {
    setPage(lastReachablePage);
  }

  return { page, setPage };
}
