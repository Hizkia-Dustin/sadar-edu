import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const EMPTY = { type: 'FeatureCollection', features: [] };

// Lapisan geografis publik terpisah dari data MCDA agar dashboard tidak berubah.
export function useBogorLayers() {
  const [population, setPopulation] = useState(EMPTY);
  const [blankSpots, setBlankSpots] = useState(EMPTY);
  const [needs, setNeeds] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Penduduk boleh tampil lebih dahulu; query buffer sekolah tidak menahan poligon.
    const requests = [
      // Versi mencegah cache lama menyajikan batas campuran setelah perbaikan topologi.
      ['population', '/analisis/penduduk', { version: 'big-2022-topology-1' }, setPopulation],
      ['access', '/analisis/blank-spots', { scope: 'bogor' }, setBlankSpots],
      ['needs', '/analisis/kebutuhan-bogor', undefined, setNeeds],
    ].map(async ([key, url, query, update]) => {
      try {
        const result = await api.get(url, query, { signal: controller.signal });
        if (!controller.signal.aborted) {
          update(result.data);
          setErrors((previous) => ({ ...previous, [key]: null }));
        }
      } catch (error) {
        if (!controller.signal.aborted) setErrors((previous) => ({ ...previous, [key]: error.message }));
      }
    });
    Promise.all(requests).then(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  return { population, blankSpots, needs, loading, errors, retry };
}
