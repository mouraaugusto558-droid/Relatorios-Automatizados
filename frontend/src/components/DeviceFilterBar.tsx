import { useEffect, useMemo, useState } from "react";
import { Filter, X, Save, Trash2 } from "lucide-react";
import type { Device } from "../hooks/useDevices";
import type { DeviceFilterCriteria } from "../hooks/useSpreadsheet";
import { useStatusOptions, type StatusOption } from "../hooks/useStatusOptions";

interface DeviceFilterBarProps {
  devices: Device[];
  onApply: (criteria: DeviceFilterCriteria) => void;
  onClear: () => void;
  isApplying?: boolean;
  /** Filtro atualmente salvo no banco — o que o relatório das 08:00 usa de verdade. */
  savedCriteria: DeviceFilterCriteria;
  onSave: (criteria: DeviceFilterCriteria) => void;
  onClearSaved: () => void;
  isSaving?: boolean;
}

type BatteryFilter = "any" | "true" | "false";

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

interface MultiSelectFieldProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
}

/**
 * Substitui o `<select multiple>` nativo (que exige Ctrl/Cmd+clique pra
 * selecionar mais de uma opção — não é óbvio e foi confundido com "só dá
 * pra escolher 1 por vez" no teste do usuário). Checkbox = sem ambiguidade
 * sobre o que está selecionado, e com busca embutida pra listas grandes
 * (ex.: 500+ cidades).
 */
function MultiSelectField({ label, options, selected, onChange, searchPlaceholder }: MultiSelectFieldProps) {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.toLowerCase().includes(term));
  }, [options, search]);

  return (
    <div>
      <span className="filter-field-label">
        {label}
        {selected.length > 0 && <span className="multiselect-count"> ({selected.length} selecionada{selected.length > 1 ? "s" : ""})</span>}
      </span>
      <div className="multiselect-box">
        {options.length > 8 && (
          <input
            type="text"
            className="multiselect-search"
            placeholder={searchPlaceholder ?? "Buscar..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <div className="multiselect-list">
          {filteredOptions.length === 0 ? (
            <div className="multiselect-empty">Nada encontrado</div>
          ) : (
            filteredOptions.map((option) => (
              <label key={option} className="multiselect-row">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onChange(toggleValue(selected, option))}
                />
                <span>{option}</span>
              </label>
            ))
          )}
        </div>
      </div>
      {selected.length > 0 ? (
        <button type="button" className="multiselect-clear" onClick={() => onChange([])}>
          Limpar seleção
        </button>
      ) : (
        <span className="multiselect-hint">Nenhuma marcada = todas</span>
      )}
    </div>
  );
}

function hasAnyCriteria(criteria: DeviceFilterCriteria): boolean {
  return Boolean(
    criteria.statuses?.length ||
      criteria.levelMin !== undefined ||
      criteria.levelMax !== undefined ||
      criteria.cities?.length ||
      criteria.regions?.length ||
      criteria.products?.length ||
      criteria.search ||
      criteria.batteryAlarm !== undefined
  );
}

function describeCriteria(criteria: DeviceFilterCriteria, statusOptions: StatusOption[]): string {
  const parts: string[] = [];
  if (criteria.statuses?.length) {
    const labels = criteria.statuses.map((value) => statusOptions.find((o) => o.value === value)?.label ?? value);
    parts.push(`status ${labels.join(" ou ")}`);
  }
  if (criteria.levelMin !== undefined) parts.push(`nível ≥ ${criteria.levelMin}%`);
  if (criteria.levelMax !== undefined) parts.push(`nível ≤ ${criteria.levelMax}%`);
  if (criteria.cities?.length) parts.push(`cidade ${criteria.cities.join(" ou ")}`);
  if (criteria.regions?.length) parts.push(`região ${criteria.regions.join(" ou ")}`);
  if (criteria.products?.length) parts.push(`produto ${criteria.products.join(" ou ")}`);
  if (criteria.search) parts.push(`busca "${criteria.search}"`);
  if (criteria.batteryAlarm !== undefined) parts.push(criteria.batteryAlarm ? "com alarme de bateria" : "sem alarme de bateria");
  return parts.join(" E ");
}

export function DeviceFilterBar({
  devices,
  onApply,
  onClear,
  isApplying = false,
  savedCriteria,
  onSave,
  onClearSaved,
  isSaving = false
}: DeviceFilterBarProps) {
  const statusOptions = useStatusOptions();
  const cityOptions = useMemo(() => uniqueSorted(devices.map((d) => d.City)), [devices]);
  const regionOptions = useMemo(() => uniqueSorted(devices.map((d) => d.Region)), [devices]);
  const productOptions = useMemo(() => uniqueSorted(devices.map((d) => d.Product)), [devices]);

  const [statuses, setStatuses] = useState<string[]>([]);
  const [levelMin, setLevelMin] = useState("");
  const [levelMax, setLevelMax] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [batteryAlarm, setBatteryAlarm] = useState<BatteryFilter>("any");

  // Inicializa o formulário com o filtro já salvo (assim que ele chega da API),
  // pra quem abre a tela ver o que está configurado hoje em vez de um formulário vazio.
  useEffect(() => {
    setStatuses(savedCriteria.statuses ?? []);
    setLevelMin(savedCriteria.levelMin !== undefined ? String(savedCriteria.levelMin) : "");
    setLevelMax(savedCriteria.levelMax !== undefined ? String(savedCriteria.levelMax) : "");
    setCities(savedCriteria.cities ?? []);
    setRegions(savedCriteria.regions ?? []);
    setProducts(savedCriteria.products ?? []);
    setSearch(savedCriteria.search ?? "");
    setBatteryAlarm(savedCriteria.batteryAlarm === undefined ? "any" : savedCriteria.batteryAlarm ? "true" : "false");
  }, [savedCriteria]);

  const hasActiveFilter =
    statuses.length > 0 ||
    levelMin !== "" ||
    levelMax !== "" ||
    cities.length > 0 ||
    regions.length > 0 ||
    products.length > 0 ||
    search.trim() !== "" ||
    batteryAlarm !== "any";

  const buildCriteria = (): DeviceFilterCriteria => ({
    statuses: statuses.length > 0 ? statuses : undefined,
    levelMin: levelMin !== "" ? Number(levelMin) : undefined,
    levelMax: levelMax !== "" ? Number(levelMax) : undefined,
    cities: cities.length > 0 ? cities : undefined,
    regions: regions.length > 0 ? regions : undefined,
    products: products.length > 0 ? products : undefined,
    search: search.trim() || undefined,
    batteryAlarm: batteryAlarm === "any" ? undefined : batteryAlarm === "true"
  });

  const handleApply = () => onApply(buildCriteria());
  const handleSave = () => onSave(buildCriteria());
  const savedIsActive = hasAnyCriteria(savedCriteria);

  const handleClear = () => {
    setStatuses([]);
    setLevelMin("");
    setLevelMax("");
    setCities([]);
    setRegions([]);
    setProducts([]);
    setSearch("");
    setBatteryAlarm("any");
    onClear();
  };

  return (
    <div className="card">
      <h3 className="card-title">
        <Filter size={18} color="var(--accent-blue)" />
        Filtro
      </h3>
      <p className="card-subtitle">
        Combine critérios (ex.: status &quot;Nível alto&quot; E nível ≥ 90) para ver só o que interessa.
      </p>

      <p className="fs-082 mt-035">
        <strong>Filtro do relatório diário (08:00):</strong>{" "}
        {savedIsActive ? (
          <span className="text-brand">{describeCriteria(savedCriteria, statusOptions)}</span>
        ) : (
          <span className="text-muted">nenhum salvo — inclui todos os tanques não excluídos</span>
        )}
      </p>

      <div className="flex-row-wrap gap-100 mt-075">
        <div>
          <span className="filter-field-label">Status</span>
          <div className="flex-row-wrap gap-035">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip-toggle ${statuses.includes(option.value) ? "active" : ""}`}
                onClick={() => setStatuses((prev) => toggleValue(prev, option.value))}
              >
                {option.label}
              </button>
            ))}
          </div>
          {statuses.length === 0 && <span className="multiselect-hint">Nenhum marcado = todos</span>}
        </div>
      </div>

      <div className="flex-row-wrap gap-100 mt-075">
        <div>
          <span className="filter-field-label">Nível mínimo (%)</span>
          <input
            type="number"
            className="input-number"
            min={0}
            max={100}
            value={levelMin}
            onChange={(e) => setLevelMin(e.target.value)}
            placeholder="mín"
          />
        </div>

        <div>
          <span className="filter-field-label">Nível máximo (%)</span>
          <input
            type="number"
            className="input-number"
            min={0}
            max={100}
            value={levelMax}
            onChange={(e) => setLevelMax(e.target.value)}
            placeholder="máx"
          />
        </div>

        <div>
          <span className="filter-field-label">Bateria</span>
          <select
            className="select-filter"
            value={batteryAlarm}
            onChange={(e) => setBatteryAlarm(e.target.value as BatteryFilter)}
          >
            <option value="any">Qualquer</option>
            <option value="true">Só com alarme</option>
            <option value="false">Só sem alarme</option>
          </select>
        </div>

        <div className="flex-1-min0">
          <span className="filter-field-label">Buscar por nome/tanque</span>
          <input
            type="text"
            className="select-filter"
            style={{ width: "100%" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, TankName ou TankNumber..."
          />
        </div>
      </div>
      <p className="fs-072 text-muted mt-015">Nível em branco = sem limite naquela ponta.</p>

      <div className="flex-row-wrap gap-100 mt-075">
        <MultiSelectField
          label="Cidade"
          options={cityOptions}
          selected={cities}
          onChange={setCities}
          searchPlaceholder="Buscar cidade..."
        />
        <MultiSelectField label="Região" options={regionOptions} selected={regions} onChange={setRegions} />
        <MultiSelectField label="Produto" options={productOptions} selected={products} onChange={setProducts} />
      </div>

      <div className="flex-row-wrap gap-050 mt-100">
        <button className="btn btn-primary btn-sm" onClick={handleApply} disabled={isApplying}>
          <Filter size={14} />
          Aplicar filtro (visualizar)
        </button>
        {hasActiveFilter && (
          <button className="btn btn-secondary btn-sm" onClick={handleClear} disabled={isApplying}>
            <X size={14} />
            Limpar filtro
          </button>
        )}
        <button className="btn btn-outline-primary btn-sm" onClick={handleSave} disabled={isSaving}>
          <Save size={14} />
          Salvar como filtro do relatório diário
        </button>
        {savedIsActive && (
          <button className="btn btn-secondary btn-sm" onClick={onClearSaved} disabled={isSaving}>
            <Trash2 size={14} />
            Remover filtro salvo
          </button>
        )}
      </div>
    </div>
  );
}
