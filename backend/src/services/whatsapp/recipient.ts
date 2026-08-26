export type Recipient = { type: "individual"; number: string } | { type: "group"; groupId: string };

function isRecipient(value: unknown): value is Recipient {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.type === "individual") return typeof obj.number === "string" && obj.number.length > 0;
  if (obj.type === "group") return typeof obj.groupId === "string" && obj.groupId.length > 0;
  return false;
}

/**
 * Lê o destinatário salvo (JSON de `Recipient`). Linhas gravadas antes desta
 * feature existir guardam só a string de dígitos do telefone — tratamos esse
 * caso como `{ type: "individual", number: raw }` pra não quebrar quem já
 * tinha configurado o relatório.
 */
export function parseRecipient(raw: string | undefined): Recipient | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecipient(parsed)) return parsed;
  } catch {
    // não era JSON — cai no tratamento de string legada abaixo.
  }

  return { type: "individual", number: raw };
}

export function buildRecipientJid(recipient: Recipient): string {
  if (recipient.type === "group") return recipient.groupId;
  const digits = recipient.number.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

/**
 * Valida um `Recipient` vindo de um body de requisição não confiável (PUT).
 * Retorna `null` se o formato for inválido — quem chama decide o 400.
 */
export function sanitizeRecipientInput(input: unknown): Recipient | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;

  if (obj.type === "individual") {
    if (typeof obj.number !== "string") return null;
    const digits = obj.number.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return { type: "individual", number: digits };
  }

  if (obj.type === "group") {
    if (typeof obj.groupId !== "string" || !obj.groupId.endsWith("@g.us")) return null;
    return { type: "group", groupId: obj.groupId };
  }

  return null;
}
