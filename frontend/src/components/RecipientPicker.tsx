import { Users, Phone, RefreshCw } from "lucide-react";
import type { Recipient } from "../hooks/useRecipient";
import type { WhatsAppGroup } from "../hooks/useWhatsAppGroups";

interface RecipientPickerProps {
  value: Recipient | null;
  onChange: (value: Recipient) => void;
  groups: WhatsAppGroup[];
  groupsConnected: boolean;
  isLoadingGroups?: boolean;
  onRefreshGroups?: () => void;
}

/**
 * Escolhe entre um número individual ou um grupo do WhatsApp — reaproveitado
 * tanto pelo destinatário do relatório das 08:00 quanto pelo dos alertas.
 * Componente controlado: quem usa guarda o rascunho e decide quando salvar.
 */
export function RecipientPicker({
  value,
  onChange,
  groups,
  groupsConnected,
  isLoadingGroups,
  onRefreshGroups
}: RecipientPickerProps) {
  const mode = value?.type ?? "individual";
  const numberDraft = value?.type === "individual" ? value.number : "";
  const groupIdDraft = value?.type === "group" ? value.groupId : "";

  return (
    <div>
      <div className="flex-row-wrap gap-050 mb-050">
        <button
          type="button"
          className={`chip-toggle ${mode === "individual" ? "active" : ""}`}
          onClick={() => onChange({ type: "individual", number: numberDraft })}
        >
          <Phone size={13} /> Número individual
        </button>
        <button
          type="button"
          className={`chip-toggle ${mode === "group" ? "active" : ""}`}
          onClick={() => onChange({ type: "group", groupId: groupIdDraft || groups[0]?.id || "" })}
        >
          <Users size={13} /> Grupo do WhatsApp
        </button>
      </div>

      {mode === "individual" ? (
        <input
          type="text"
          className="input-text"
          style={{ paddingLeft: "0.85rem", maxWidth: "340px" }}
          placeholder="Ex: 5511999999999"
          value={numberDraft}
          onChange={(e) => onChange({ type: "individual", number: e.target.value })}
        />
      ) : groups.length > 0 ? (
        <div className="flex-row-wrap gap-050">
          <select
            className="select-filter"
            style={{ maxWidth: "340px" }}
            value={groupIdDraft}
            onChange={(e) => onChange({ type: "group", groupId: e.target.value })}
          >
            <option value="" disabled>
              Selecione um grupo...
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {onRefreshGroups && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRefreshGroups} disabled={isLoadingGroups}>
              <RefreshCw size={13} className={isLoadingGroups ? "spinner" : ""} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex-row-wrap gap-050">
          <p className="fs-082 text-muted">
            {groupsConnected
              ? "Nenhum grupo encontrado — entre no grupo desejado pelo celular conectado ao WhatsApp e atualize a lista."
              : "Conecte o WhatsApp primeiro para listar os grupos disponíveis."}
          </p>
          {onRefreshGroups && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRefreshGroups} disabled={isLoadingGroups}>
              <RefreshCw size={13} className={isLoadingGroups ? "spinner" : ""} />
              Atualizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
