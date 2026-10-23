import { useSearchParams } from 'react-router-dom';
import { listStateFromParams, paramsFromListState } from '../lib/list.js';

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
