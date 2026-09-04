import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const uniqueId = "5c664f6f-a4f9-448e-bf0a-aa6ce85f9d73";

export const DATA_TEST_ID = {
  CONTAINER: `table-pagination-container-${uniqueId}`,
  RANGE: `table-pagination-range-${uniqueId}`,
  PREVIOUS_BUTTON: `table-pagination-previous-button-${uniqueId}`,
  NEXT_BUTTON: `table-pagination-next-button-${uniqueId}`,
  PAGE_BUTTON: `table-pagination-page-button-${uniqueId}`,
  ELLIPSIS: `table-pagination-ellipsis-${uniqueId}`,
};

const SKIPPED_PAGES = "skipped-pages";

type PageSlot = number | typeof SKIPPED_PAGES;

const FIRST_PAGE = 1;
const PAGE_SLOTS_OFFERED_WHATEVER_THE_CURRENT_PAGE = 5;
const LAST_PAGE_OF_THE_OPENING_RUN = PAGE_SLOTS_OFFERED_WHATEVER_THE_CURRENT_PAGE - 2;

function pagesFromTo(firstPage: number, lastPage: number): number[] {
  return Array.from({ length: lastPage - firstPage + 1 }, (_, offset) => firstPage + offset);
}

function pageSlotsFor(currentPage: number, pageCount: number): PageSlot[] {
  const everyPageFitsInTheSlots = pageCount <= PAGE_SLOTS_OFFERED_WHATEVER_THE_CURRENT_PAGE;
  if (everyPageFitsInTheSlots) return pagesFromTo(FIRST_PAGE, pageCount);

  const firstPageOfTheClosingRun = pageCount - LAST_PAGE_OF_THE_OPENING_RUN + 1;

  if (currentPage <= LAST_PAGE_OF_THE_OPENING_RUN) {
    return [...pagesFromTo(FIRST_PAGE, LAST_PAGE_OF_THE_OPENING_RUN), SKIPPED_PAGES, pageCount];
  }
  if (currentPage >= firstPageOfTheClosingRun) {
    return [FIRST_PAGE, SKIPPED_PAGES, ...pagesFromTo(firstPageOfTheClosingRun, pageCount)];
  }
  return [FIRST_PAGE, SKIPPED_PAGES, currentPage, SKIPPED_PAGES, pageCount];
}

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function TablePagination({ page, pageSize, total, onPageChange, className }: Readonly<TablePaginationProps>) {
  const { t } = useTranslation();

  const pageCount = Math.ceil(total / pageSize);
  const everyRowFitsOnOnePage = pageCount <= 1;
  if (everyRowFitsOnOnePage) return null;

  const currentPage = Math.min(Math.max(page, FIRST_PAGE), pageCount);
  const firstRowOnPage = Math.min((currentPage - 1) * pageSize + 1, total);
  const lastRowOnPage = Math.min(currentPage * pageSize, total);
  const isOnFirstPage = currentPage === FIRST_PAGE;
  const isOnLastPage = currentPage === pageCount;

  return (
    <div data-testid={DATA_TEST_ID.CONTAINER} className={cn("@container", className)}>
      <div className="flex flex-wrap items-center justify-center gap-3 @sm:justify-between">
        <p data-testid={DATA_TEST_ID.RANGE} aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          {t("shared.pagination.range", { from: firstRowOnPage, to: lastRowOnPage, total })}
        </p>

        <Pagination aria-label={t("shared.pagination.label")} className="mx-0 w-auto justify-center @sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink asChild size="icon-sm" className="hover:bg-primary/10 hover:text-primary">
                <button
                  type="button"
                  disabled={isOnFirstPage}
                  aria-label={t("shared.pagination.previous")}
                  data-testid={DATA_TEST_ID.PREVIOUS_BUTTON}
                  onClick={() => onPageChange(currentPage - 1)}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </button>
              </PaginationLink>
            </PaginationItem>

            {pageSlotsFor(currentPage, pageCount).map((slot, index) => (
              <PaginationItem key={slot === SKIPPED_PAGES ? `${slot}-${index}` : slot}>
                {slot === SKIPPED_PAGES ? (
                  <span
                    aria-hidden="true"
                    data-testid={DATA_TEST_ID.ELLIPSIS}
                    className="flex size-8 items-center justify-center gap-0.75 text-muted-foreground"
                  >
                    <span className="size-0.75 rounded-full bg-current" />
                    <span className="size-0.75 rounded-full bg-current" />
                    <span className="size-0.75 rounded-full bg-current" />
                  </span>
                ) : (
                  <PaginationLink
                    asChild
                    size="icon-sm"
                    isActive={slot === currentPage}
                    variant={slot === currentPage ? "default" : "ghost"}
                    className={slot === currentPage ? undefined : "hover:bg-primary/10 hover:text-primary"}
                  >
                    <button
                      type="button"
                      aria-label={t("shared.pagination.page", { value: slot })}
                      data-testid={DATA_TEST_ID.PAGE_BUTTON}
                      data-page={slot}
                      onClick={() => onPageChange(slot)}
                      className="font-mono tabular-nums"
                    >
                      {slot}
                    </button>
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationLink asChild size="icon-sm" className="hover:bg-primary/10 hover:text-primary">
                <button
                  type="button"
                  disabled={isOnLastPage}
                  aria-label={t("shared.pagination.next")}
                  data-testid={DATA_TEST_ID.NEXT_BUTTON}
                  onClick={() => onPageChange(currentPage + 1)}
                >
                  <ChevronRightIcon aria-hidden="true" />
                </button>
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
