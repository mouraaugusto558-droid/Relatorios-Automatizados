import type { OtodataDevice } from "../otodata";

export interface DeviceFilterCriteria {
  /** Valores de `device.Status` (chave crua, ex.: "HIGH ALARM"). Vazio/ausente = qualquer status. */
  statuses?: string[];
  /** Nível mínimo em porcentagem (0-100), comparado com `LastLevel * 100`. */
  levelMin?: number;
  /** Nível máximo em porcentagem (0-100). */
  levelMax?: number;
  cities?: string[];
  regions?: string[];
  products?: string[];
  /** Busca livre (substring, case-insensitive) em Name/TankName/TankNumber. */
  search?: string;
  /** `undefined` = qualquer; `true`/`false` filtra só quem tem/não tem alarme de bateria. */
  batteryAlarm?: boolean;
}

function matchesAnyCaseInsensitive(value: string | null, options: string[]): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return options.some((option) => option.toLowerCase() === normalized);
}

/**
 * Aplica todos os critérios presentes em `criteria` com "E" entre categorias
 * diferentes (ex.: status E nível), e "OU" dentro da mesma categoria (ex.:
 * status pertence a um dos valores selecionados) — é o comportamento pedido
 * pelo cliente ("status = X" E "nível > 90").
 */
export function filterDevices(devices: OtodataDevice[], criteria: DeviceFilterCriteria): OtodataDevice[] {
  return devices.filter((device) => {
    if (criteria.statuses && criteria.statuses.length > 0) {
      if (!criteria.statuses.includes(device.Status)) return false;
    }

    if (criteria.levelMin !== undefined || criteria.levelMax !== undefined) {
      if (device.LastLevel === null) return false;
      const levelPercent = device.LastLevel * 100;
      if (criteria.levelMin !== undefined && levelPercent < criteria.levelMin) return false;
      if (criteria.levelMax !== undefined && levelPercent > criteria.levelMax) return false;
    }

    if (criteria.cities && criteria.cities.length > 0 && !matchesAnyCaseInsensitive(device.City, criteria.cities)) {
      return false;
    }

    if (
      criteria.regions &&
      criteria.regions.length > 0 &&
      !matchesAnyCaseInsensitive(device.Region, criteria.regions)
    ) {
      return false;
    }

    if (
      criteria.products &&
      criteria.products.length > 0 &&
      !matchesAnyCaseInsensitive(device.Product, criteria.products)
    ) {
      return false;
    }

    if (criteria.search) {
      const term = criteria.search.toLowerCase();
      const haystack = [device.Name, device.TankName, device.TankNumber]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      if (!haystack.some((value) => value.includes(term))) return false;
    }

    if (criteria.batteryAlarm !== undefined && device.BatteryAlarm !== criteria.batteryAlarm) {
      return false;
    }

    return true;
  });
}

function splitCommaList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/**
 * Lê os critérios a partir da querystring, sempre como strings únicas
 * (listas separadas por vírgula) — evita depender de como o Fastify decide
 * parsear parâmetros repetidos (`?city=A&city=B`).
 */
export function parseFilterQuery(query: Record<string, string | undefined>): DeviceFilterCriteria {
  return {
    statuses: splitCommaList(query.status),
    levelMin: parseNumber(query.levelMin),
    levelMax: parseNumber(query.levelMax),
    cities: splitCommaList(query.city),
    regions: splitCommaList(query.region),
    products: splitCommaList(query.product),
    search: query.search?.trim() || undefined,
    batteryAlarm: parseBoolean(query.batteryAlarm)
  };
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Sanitiza um objeto de origem não confiável (body de um PUT) pra um
 * `DeviceFilterCriteria` válido — descarta qualquer campo com tipo errado
 * em vez de rejeitar a requisição inteira, já que isto persiste no banco e
 * passa a valer pro relatório automático das 08:00 (não dá pra deixar lixo
 * gravado ali).
 */
export function sanitizeCriteria(input: unknown): DeviceFilterCriteria {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;

  return {
    statuses: asStringArray(obj.statuses),
    levelMin: asFiniteNumber(obj.levelMin),
    levelMax: asFiniteNumber(obj.levelMax),
    cities: asStringArray(obj.cities),
    regions: asStringArray(obj.regions),
    products: asStringArray(obj.products),
    search: typeof obj.search === "string" && obj.search.trim() ? obj.search.trim() : undefined,
    batteryAlarm: typeof obj.batteryAlarm === "boolean" ? obj.batteryAlarm : undefined
  };
}
