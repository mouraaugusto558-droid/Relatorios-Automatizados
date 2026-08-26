import { Table2, RotateCw, FolderOpen } from "lucide-react";
import { useSpreadsheet, type SpreadsheetTable, type DeviceFilterCriteria } from "../hooks/useSpreadsheet";
import { useDevices } from "../hooks/useDevices";
import { useReportFilter } from "../hooks/useReportFilter";
import { useApiAction } from "../hooks/useApiAction";
import { DeviceFilterBar } from "./DeviceFilterBar";
import { formatDateTime } from "../utils/formatDateTime";

function SpreadsheetTableView({ table }: { table: SpreadsheetTable }) {
  return (
    <div className="spreadsheet-table-wrapper">
      <div className="spreadsheet-table-title">{table.title}</div>

      {table.rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-description">Nenhum registro nesta lista.</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.cells.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      {cellIndex === 0 && (
                        <span className="spreadsheet-status-dot" style={{ backgroundColor: row.color }} />
                      )}
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SpreadsheetPanel() {
  const { data, isLoading, refresh } = useSpreadsheet();
  const { devices } = useDevices();
  const { criteria: savedCriteria, save: saveReportFilter } = useReportFilter();

  const refreshAction = useApiAction<[DeviceFilterCriteria?], void>(refresh, {
    success: () => ({
      title: "Planilha atualizada",
      message: "Os dados foram recarregados a partir da Otodata."
    }),
    error: () => ({
      title: "Falha ao atualizar",
      message: "Não foi possível recarregar a planilha."
    })
  });

  const saveFilterAction = useApiAction(saveReportFilter, {
    success: () => ({
      title: "Filtro salvo",
      message: "O relatório das 08:00 (e o \"Rodar agora\") agora vai considerar esse filtro."
    }),
    error: () => ({
      title: "Falha ao salvar filtro",
      message: "Não foi possível salvar o filtro do relatório diário."
    })
  });

  const handleApplyFilter = (criteria: DeviceFilterCriteria) => void refreshAction.run(criteria);
  const handleClearFilter = () => void refreshAction.run({});
  const handleSaveFilter = (criteria: DeviceFilterCriteria) => void saveFilterAction.run(criteria);
  const handleClearSavedFilter = () => void saveFilterAction.run({});

  return (
    <div className="section-stack">
      <div className="card">
        <div className="flex-between mb-125">
          <div>
            <h2 className="card-title">
              <Table2 size={20} color="var(--accent-purple)" />
              Planilha (alarmes e abastecimentos)
            </h2>
            <p className="card-subtitle">
              Mesma listagem enviada como imagem no WhatsApp junto ao relatório diário.
              {data && ` Gerada em ${formatDateTime(data.generatedAt)}.`}
              {data && data.filteredDevices !== data.totalDevices && (
                <> Mostrando {data.filteredDevices} de {data.totalDevices} tanques (filtro ativo).</>
              )}
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => void refreshAction.run()}
            disabled={refreshAction.isPending || isLoading}
          >
            <RotateCw size={14} className={refreshAction.isPending || isLoading ? "spinner" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <DeviceFilterBar
        devices={devices}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        isApplying={refreshAction.isPending}
        savedCriteria={savedCriteria}
        onSave={handleSaveFilter}
        onClearSaved={handleClearSavedFilter}
        isSaving={saveFilterAction.isPending}
      />

      {!data ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <FolderOpen size={26} />
            </div>
            <div className="empty-title">Carregando planilha...</div>
          </div>
        </div>
      ) : (
        <>
          {data.alarms.map((table) => (
            <SpreadsheetTableView key={table.title} table={table} />
          ))}
          {data.fills.map((table) => (
            <SpreadsheetTableView key={table.title} table={table} />
          ))}
        </>
      )}
    </div>
  );
}
