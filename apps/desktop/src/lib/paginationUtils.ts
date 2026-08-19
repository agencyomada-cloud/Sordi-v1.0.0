/**
 * Pagination constants and utilities for A4 documents
 */

export const ITEMS_PER_PAGE = 9;
export const ITEMS_PER_LAST_PAGE = 5;

/**
 * Chunks items into pages based on standard and last-page capacity.
 * @param items The list of invoice/order items
 * @returns An array of item arrays, each representing a page
 */
export function chunkItems(items: any[]): any[][] {
    const pages: any[][] = [];
    if (!items || items.length === 0) {
        pages.push([]);
        return pages;
    }

    let remaining = [...items];
    while (remaining.length > 0) {
        // If we have ITEMS_PER_PAGE or fewer items remaining
        if (remaining.length <= ITEMS_PER_PAGE) {
            // Case 1: 1 to 6 items -> Fits on one page WITH totals
            if (remaining.length <= ITEMS_PER_LAST_PAGE) {
                pages.push(remaining);
                remaining = [];
            } else {
                // Case 2: 7 to 9 items -> Products fill this page, but totals need a new empty page
                pages.push(remaining);
                pages.push([]); // Add empty page for totals
                remaining = [];
            }
        } else {
            // Case 3: More than 9 items -> Fill a full page and continue
            pages.push(remaining.slice(0, ITEMS_PER_PAGE));
            remaining = remaining.slice(ITEMS_PER_PAGE);
        }
    }

    return pages;
}
