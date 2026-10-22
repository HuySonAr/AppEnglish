import { useSearchParams } from 'react-router-dom';
import { listStateFromParams, paramsFromListState } from '../lib/list.js';

// Search, filters and page of a list, kept in the URL query (D130): leaving
// for an item and coming back, or reloading, shows the same page with the
// same filters. defaults names every filter with its default value.
//   filters, page          the current state
//   setFilter(name)(value) changes one filter and goes back to page 1
//   setFilters(next)       replaces the filters (object or updater), page 1
//   setPage(page)          number or updater
export function useListState(defaults) {
  const [params, setParams] = useSearchParams();
  const state = listStateFromParams(params, defaults);
  const write = (next) => setParams(paramsFromListState(next, defaults, params), { replace: true });
  return {
    filters: state.filters,
    page: state.page,
    setPage: (page) => write({ filters: state.filters, page: typeof page === 'function' ? page(state.page) : page }),
    setFilter: (name) => (value) => write({ filters: { ...state.filters, [name]: value }, page: 1 }),
    setFilters: (next) => write({ filters: typeof next === 'function' ? next(state.filters) : next, page: 1 }),
  };
}
