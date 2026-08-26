import { useMemo, useState } from "react";
import { UserX, RotateCw, Search, ClipboardList, Undo2, FolderOpen } from "lucide-react";
import { useDevices, type Device } from "../hooks/useDevices";
import { useExcludedDevices, type ExcludedDevice } from "../hooks/useExcludedDevices";
import { useStatusOptions } from "../hooks/useStatusOptions";
import { useApiAction } from "../hooks/useApiAction";
import { CopyButton } from "./CopyButton";
import { ConfirmModal } from "./ConfirmModal";
import { formatDateTime } from "../utils/formatDateTime";

function formatLevelPercent(level: number | null): string {
  return level === null ? "N/D" : `${Math.round(level * 100)}%`;
}

interface ParsedPreview {
  found: Device[];
  notFoundIds: number[];
  invalidTokens: string[];
}

function parsePastedIds(text: string, devices: Device[]): ParsedPreview {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const deviceById = new Map(devices.map((device) => [device.Id, device]));

  const found: Device[] = [];
  const notFoundIds: number[] = [];
  const invalidTokens: string[] = [];
  const seen = new Set<number>();

  for (const token of tokens) {
    const id = Number(token);
    if (!Number.isInteger(id)) {
      invalidTokens.push(token);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);

    const device = deviceById.get(id);
    if (device) {
      found.push(device);
    } else {
      notFoundIds.push(id);
    }
  }

  return { found, notFoundIds, invalidTokens };
}

export function ExclusionPanel() {
  const { devices, isLoading: devicesLoading, refresh: refreshDevices } = useDevices();
  const { excludedList, excludedIds, exclude, restore, refresh: refreshExcluded } = useExcludedDevices();
  const statusOptions = useStatusOptions();
  const statusByValue = useMemo(() => new Map(statusOptions.map((option) => [option.value, option])), [
    statusOptions
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [confirmingBulk, setConfirmingBulk] = useState(false);

  const filteredDevices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return devices;
    return devices.filter(
      (device) =>
        (device.Name ?? "").toLowerCase().includes(term) ||
        (device.City ?? "").toLowerCase().includes(term) ||
        String(device.Id).includes(term)
    );
  }, [devices, searchTerm]);

  const refreshAllAction = useApiAction(
    async () => {
      await Promise.all([refreshDevices(), refreshExcluded()]);
    },
    {
      success: () => ({ title: "Lista atualizada", message: "Clientes recarregados a partir da Otodata." }),
      error: () => ({ title: "Falha ao atualizar", message: "Não foi possível recarregar a lista de clientes." })
    }
  );

  const excludeOneAction = useApiAction(
    async (device: Device) => {
      await exclude([device.Id]);
    },
    {
      success: (_result, device) => ({
        title: "Cliente excluído",
        message: `${device.Name ?? `Tanque #${device.Id}`} não vai mais aparecer nos relatórios.`
      }),
      error: () => ({ title: "Falha ao excluir", message: "Não foi possível excluir este cliente." })
    }
  );

  const restoreAction = useApiAction(
    async (device: ExcludedDevice) => {
      await restore(device.deviceId);
    },
    {
      success: (_result, device) => ({
        title: "Cliente restaurado",
        message: `${device.name ?? `Tanque #${device.deviceId}`} volta a aparecer nos relatórios.`
      }),
      error: () => ({ title: "Falha ao restaurar", message: "Não foi possível restaurar este cliente." })
    }
  );

  const bulkExcludeAction = useApiAction(
    async (ids: number[]) => {
      await exclude(ids);
    },
    {
      success: (_result, ids) => ({
        title: "Clientes excluídos",
        message: `${ids.length} cliente(s) não vão mais aparecer nos relatórios.`
      }),
      error: () => ({ title: "Falha ao excluir em lote", message: "Não foi possível excluir a lista colada." })
    }
  );

  const handleAnalyzePaste = () => {
    setPreview(parsePastedIds(pasteText, devices));
  };

  const handleConfirmBulkExclude = async () => {
    if (!preview || preview.found.length === 0) return;
    await bulkExcludeAction.run(preview.found.map((device) => device.Id));
    setConfirmingBulk(false);
    setPasteText("");
    setPreview(null);
  };

  return (
    <div className="section-stack">
      <div className="card">
        <div className="flex-between mb-125">
          <div>
            <h2 className="card-title">
              <UserX size={20} color="var(--accent-rose)" />
              Excluir Clientes
            </h2>
            <p className="card-subtitle">
              Clientes excluídos deixam de aparecer no relatório diário e na aba Planilha — a exclusão é
              reversível a qualquer momento.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => void refreshAllAction.run()}
            disabled={refreshAllAction.isPending || devicesLoading}
          >
            <RotateCw size={14} className={refreshAllAction.isPending || devicesLoading ? "spinner" : ""} />
            Atualizar
          </button>
        </div>

        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome, cidade ou ID..."
            className="input-text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Colar lista de IDs */}
      <div className="card">
        <h3 className="card-title">
          <ClipboardList size={18} color="var(--accent-blue)" />
          Excluir vários de uma vez
        </h3>
        <p className="card-subtitle">
          Cole uma lista de IDs (separados por vírgula, espaço ou quebra de linha) e confira a prévia antes de
          confirmar.
        </p>

        <textarea
          className="textarea-paste-ids"
          placeholder={"27084378, 27086941\n27091234"}
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            setPreview(null);
          }}
          rows={4}
        />

        <div className="flex-row gap-050 mt-050">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleAnalyzePaste}
            disabled={!pasteText.trim()}
          >
            Analisar lista
          </button>
          {preview && preview.found.length > 0 && (
            <button className="btn btn-outline-danger btn-sm" onClick={() => setConfirmingBulk(true)}>
              Excluir {preview.found.length} cliente(s)
            </button>
          )}
        </div>

        {preview && (
          <div className="mt-050 fs-085">
            {preview.found.length > 0 && (
              <div className="mb-050">
                <strong>{preview.found.length} encontrado(s):</strong>{" "}
                {preview.found
                  .map(
                    (device) =>
                      `${device.Name ?? `Tanque #${device.Id}`}${
                        excludedIds.has(device.Id) ? " (já excluído)" : ""
                      }`
                  )
                  .join(", ")}
              </div>
            )}
            {preview.notFoundIds.length > 0 && (
              <div className="mb-050 text-muted">
                {preview.notFoundIds.length} ID(s) não encontrado(s) na lista atual: {preview.notFoundIds.join(", ")}
              </div>
            )}
            {preview.invalidTokens.length > 0 && (
              <div className="text-muted">
                {preview.invalidTokens.length} valor(es) ignorado(s) (não são números): {preview.invalidTokens.join(", ")}
              </div>
            )}
            {preview.found.length === 0 && preview.notFoundIds.length === 0 && preview.invalidTokens.length === 0 && (
              <div className="text-muted">Nenhum ID reconhecido no texto colado.</div>
            )}
          </div>
        )}
      </div>

      {/* Tabela de todos os clientes */}
      {devices.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <FolderOpen size={26} />
            </div>
            <div className="empty-title">Carregando clientes...</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Cidade</th>
                <th>Status</th>
                <th>Nível</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((device) => {
                const excluded = excludedIds.has(device.Id);
                const meta = statusByValue.get(device.Status);
                return (
                  <tr key={device.Id}>
                    <td>
                      <div className="flex-row gap-035">
                        <span className="text-mono-muted">{device.Id}</span>
                        <CopyButton id={`id-${device.Id}`} value={String(device.Id)} label="Copiar ID do tanque" />
                      </div>
                    </td>
                    <td>{device.Name ?? `Tanque #${device.Id}`}</td>
                    <td>{device.City ?? "—"}</td>
                    <td>
                      {meta && <span className="spreadsheet-status-dot" style={{ backgroundColor: meta.color }} />}
                      {meta?.label ?? device.Status}
                    </td>
                    <td>{formatLevelPercent(device.LastLevel)}</td>
                    <td className="text-right">
                      {excluded ? (
                        <span className="pill pill-neutral pill-sm">Excluído</span>
                      ) : (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => void excludeOneAction.run(device)}
                          disabled={excludeOneAction.isPending}
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista de excluídos */}
      <div className="card">
        <h3 className="card-title">
          <Undo2 size={18} color="var(--brand-primary)" />
          Clientes excluídos ({excludedList.length})
        </h3>

        {excludedList.length === 0 ? (
          <p className="card-subtitle">Nenhum cliente excluído no momento.</p>
        ) : (
          <div className="table-container mt-050">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Cidade</th>
                  <th>Excluído em</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {excludedList.map((item) => (
                  <tr key={item.deviceId}>
                    <td className="text-mono-muted">{item.deviceId}</td>
                    <td>{item.name ?? `Tanque #${item.deviceId}`}</td>
                    <td>{item.city ?? "—"}</td>
                    <td>{formatDateTime(item.excludedAt)}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => void restoreAction.run(item)}
                        disabled={restoreAction.isPending}
                      >
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmingBulk && preview && (
        <ConfirmModal
          title="Excluir clientes em lote"
          message={`Confirma a exclusão de ${preview.found.length} cliente(s) dos relatórios? Isso pode ser desfeito depois na lista de excluídos.`}
          confirmLabel={`Excluir ${preview.found.length}`}
          onConfirm={() => void handleConfirmBulkExclude()}
          onCancel={() => setConfirmingBulk(false)}
        />
      )}
    </div>
  );
}
