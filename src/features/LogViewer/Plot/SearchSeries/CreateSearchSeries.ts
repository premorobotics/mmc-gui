import { createSignal, on } from "solid-js";
import { fuzzySearch } from "~/features/LogViewer/Plot/SearchSeries/FuzzySearch";
import { createEffect } from "solid-js";

export function createSearchSeries(header: string[]) {
  const [searchInput, setSearchInput] = createSignal<string>("");
  const [legendIndex, setLegendIndex] = createSignal<number[]>(
    header.map((_, i) => i),
  );

  createEffect(
    on(
      () => searchInput(),
      (searchInputValue) => {
        const parseSearchResults: string[] = fuzzySearch(
          searchInputValue,
          header,
        );
        if (searchInputValue.length === 0) {
          setLegendIndex(header.map((_, i) => i));
        } else {
          const headerIndex = parseSearchResults.map((str) =>
            header.indexOf(str),
          );
          setLegendIndex(headerIndex);
        }
      },
    ),
  );

  return {
    searchInput,
    setSearchInput,
    legendIndex,
  };
}
