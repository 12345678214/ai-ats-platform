import { useCallback, useEffect, useRef, useState } from 'react';
import { parseError } from './api';

// Runs an async loader on mount and whenever `deps` change. Ignores stale responses.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const counter = useRef(0);

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++counter.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === counter.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === counter.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error: parseError(err).message }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
