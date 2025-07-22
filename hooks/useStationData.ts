import useSWR from 'swr'

export interface StationMeasurement {
  station: string;
  date: string;
  time: string;
  maxSPLAFast: number;
  [key: string]: string | number;
}

export interface StationDataMeta {
  total: number;
  page: number;
  pageSize: number;
}

export interface UseStationDataOptions {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

function buildQuery(params: Record<string, any>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

export function useStationData(
  station: string,
  options: UseStationDataOptions = {}
) {
  const query = buildQuery({ station, ...options })
  const { data, error, isLoading, mutate } = useSWR(
    station ? `/api/station-data?${query}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Fehler beim Laden der Messwerte')
      return res.json()
    },
    { revalidateOnFocus: true }
  )
  return {
    data: (data?.data as StationMeasurement[]) ?? [],
    meta: (data?.meta as StationDataMeta) ?? { total: 0, page: 1, pageSize: 100 },
    error: error?.message ?? data?.error ?? null,
    isLoading,
    mutate,
  }
} 