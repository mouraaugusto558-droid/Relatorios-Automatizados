import { env } from "../../config/env";
import { createWhatsAppManager, type WhatsAppManager } from "./whatsappManager";

let manager: WhatsAppManager | null = null;

export function getWhatsAppManager(): WhatsAppManager {
  if (!manager) {
    manager = createWhatsAppManager(env.whatsappAuthPath);
  }
  return manager;
}

export type { WhatsAppManager, WhatsAppConnectionStatus, WhatsAppStatus } from "./whatsappManager";
