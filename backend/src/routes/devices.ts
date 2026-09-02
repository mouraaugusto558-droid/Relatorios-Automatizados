import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import { STATUS_META } from "../services/reports/deviceSelectors";
import { getAllDevices } from "../services/reports/monitoredScope";

interface ExcludeDevicesBody {
  deviceIds: number[];
}

export async function devicesRoutes(app: FastifyInstance): Promise<void> {
  const { excludedDevices: excludedDevicesRepository } = createRepositories(getDatabase());

  // Lista crua, sem nenhum filtro/exclusão aplicado — a aba de exclusão
  // precisa enxergar todo mundo, inclusive quem já está excluído, pra poder
  // restaurar.
  app.get("/api/devices", async () => await getAllDevices());

  app.get("/api/devices/status-options", async () =>
    Object.entries(STATUS_META).map(([value, meta]) => ({
      value,
      label: meta.label || value,
      color: meta.color
    }))
  );

  app.get("/api/devices/excluded", async () => excludedDevicesRepository.list());

  app.post<{ Body: ExcludeDevicesBody }>("/api/devices/excluded", async (request, reply) => {
    const deviceIds = Array.isArray(request.body?.deviceIds) ? request.body.deviceIds : [];
    if (deviceIds.length === 0) {
      return reply.code(400).send({ error: "empty_device_ids" });
    }

    const devices = await getAllDevices();
    const deviceById = new Map(devices.map((device) => [device.Id, device]));

    const excluded: number[] = [];
    const notFound: number[] = [];
    for (const deviceId of deviceIds) {
      const device = deviceById.get(deviceId);
      if (!device) {
        notFound.push(deviceId);
        continue;
      }
      excludedDevicesRepository.exclude({ deviceId, name: device.Name, city: device.City });
      excluded.push(deviceId);
    }

    return { excluded, notFound };
  });

  app.delete("/api/devices/excluded/:deviceId", async (request) => {
    const deviceId = Number((request.params as { deviceId: string }).deviceId);
    excludedDevicesRepository.restore(deviceId);
    return { restored: deviceId };
  });
}
