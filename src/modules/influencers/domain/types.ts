export interface RateJson {
  id: string;
  net: string;
  fmt: string;
  price: number;
  archivedAt?: string | null;
}

export interface AudienceJson {
  f: number;
  ages: number[];
  cities: Array<[string, number]>;
}

export type NetMap = Record<string, [number, number]>;
