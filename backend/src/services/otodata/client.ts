export interface OtodataDevice {
  Id: number;
  Name: string | null;
  City: string | null;
  Region: string | null;
  Product: string | null;
  Status: string;
  LastLevel: number | null;
  Inventory: number | null;
  Capacity: number | null;
  HoursToEmpty: number | null;
  LastFill: string | null;
  LastRead: string | null;
  BatteryAlarm: boolean;
  SignalStrength: number | null;
  TankName: string | null;
  TankNumber: string | null;
}

export interface OtodataTankLevelLog {
  Id: number;
  Level: number | null;
  LogDateUtc: string;
  BatteryLevel: number | null;
  Temperature: number | null;
  Value: number | null;
  ValueType: number | null;
  SensorTrouble: number | null;
}

export interface OtodataTankLevels {
  Id?: number;
  Count: number;
  StartDateUtc?: string;
  EndDateUtc?: string;
  Logs: OtodataTankLevelLog[];
}

const PRIMARY_URL = "https://neevo.otodata.ca/public/api/v1/DataService.svc";
const SECONDARY_URL = "https://neevo2.otodata.ca/public/api/v1/DataService.svc";

export interface OtodataClient {
  getDevices(): Promise<OtodataDevice[]>;
  getTankLevels(
    startDateUtc: string,
    endDateUtc: string,
    page?: number
  ): Promise<OtodataTankLevels[]>;
}

export function createOtodataClient(apiKey: string): OtodataClient {
  async function fetchDevicesFrom(baseUrl: string): Promise<OtodataDevice[]> {
    const response = await fetch(`${baseUrl}/devices?k=${encodeURIComponent(apiKey)}`, {
      headers: { Accept: "application/json; charset=utf-8" }
    });

    if (!response.ok) {
      throw new Error(`Otodata respondeu ${response.status} em ${baseUrl}`);
    }

    return (await response.json()) as OtodataDevice[];
  }

  async function fetchTankLevelsFrom(
    baseUrl: string,
    startDateUtc: string,
    endDateUtc: string,
    page: number
  ): Promise<OtodataTankLevels[]> {
    const params = new URLSearchParams({
      k: apiKey,
      startDateUtc,
      endDateUtc,
      page: String(page)
    });
    const response = await fetch(`${baseUrl}/tanklevels?${params.toString()}`, {
      headers: { Accept: "application/json; charset=utf-8" }
    });

    if (!response.ok) {
      throw new Error(`Otodata respondeu ${response.status} em ${baseUrl}`);
    }

    const payload = (await response.json()) as OtodataTankLevels | OtodataTankLevels[];
    return Array.isArray(payload) ? payload : [payload];
  }

  return {
    async getDevices(): Promise<OtodataDevice[]> {
      try {
        return await fetchDevicesFrom(PRIMARY_URL);
      } catch (primaryError) {
        try {
          return await fetchDevicesFrom(SECONDARY_URL);
        } catch (secondaryError) {
          const primaryMessage =
            primaryError instanceof Error ? primaryError.message : String(primaryError);
          const secondaryMessage =
            secondaryError instanceof Error ? secondaryError.message : String(secondaryError);
          throw new Error(
            `Falha ao consultar a API Otodata no servidor primário (${primaryMessage}) e no secundário (${secondaryMessage})`
          );
        }
      }
    },

    async getTankLevels(
      startDateUtc: string,
      endDateUtc: string,
      page = 0
    ): Promise<OtodataTankLevels[]> {
      try {
        return await fetchTankLevelsFrom(PRIMARY_URL, startDateUtc, endDateUtc, page);
      } catch (primaryError) {
        try {
          return await fetchTankLevelsFrom(SECONDARY_URL, startDateUtc, endDateUtc, page);
        } catch (secondaryError) {
          const primaryMessage =
            primaryError instanceof Error ? primaryError.message : String(primaryError);
          const secondaryMessage =
            secondaryError instanceof Error ? secondaryError.message : String(secondaryError);
          throw new Error(
            `Falha ao consultar o histórico Otodata no servidor primário (${primaryMessage}) e no secundário (${secondaryMessage})`
          );
        }
      }
    }
  };
}
