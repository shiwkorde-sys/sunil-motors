import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Part } from './types';

/** Loads the whole catalogue once (a shop has hundreds of parts, not millions) so searching is instant. */
export function useParts() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('parts').select('*').order('name');
    if (error) setError(error.message);
    else {
      setError(null);
      setParts(data as Part[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { parts, loading, error, reload };
}
