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

const PRIMARY_URL = "https://neevo.otodata.ca/public/api/v1/DataService.svc";
const SECONDARY_URL = "https://neevo2.otodata.ca/public/api/v1/DataService.svc";

export interface OtodataClient {
  getDevices(): Promise<OtodataDevice[]>;
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

  return {
    async getDevices(): Promise<OtodataDevice[]> {
      try {
        return await fetchDevicesFrom(PRIMARY_URL);
      } catch (primaryError) {
        try {
          return await fetchDevicesFrom(SECONDARY_URL);
        } catch (secondaryError) {
          const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
          const secondaryMessage = secondaryError instanceof Error ? secondaryError.message : String(secondaryError);
          throw new Error(
            `Falha ao consultar a API Otodata no servidor primário (${primaryMessage}) e no secundário (${secondaryMessage})`
          );
        }
      }
    }
  };
}
