import { useEffect, useState } from "react";
import {
  Bell,
  Play,
  RotateCw,
  Save,
  Send,
  History,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useAppData } from "../context/AppDataContext";
import { useApiAction } from "../hooks/useApiAction";
import { useStatusOptions } from "../hooks/useStatusOptions";
import { useAlertCriteria, type AlertTriggerConfig } from "../hooks/useAlertCriteria";
import { useAlertHistory, type AlertHistoryEntry } from "../hooks/useAlertHistory";
import { useRecipient, type Recipient } from "../hooks/useRecipient";
import { useWhatsAppGroups } from "../hooks/useWhatsAppGroups";
import { apiPost, ApiError } from "../api/client";
import { RecipientPicker } from "./RecipientPicker";
import { formatDateTime, formatRelativeTime } from "../utils/formatDateTime";

const ALERT_JOB_ID = "alertas-criticos";

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function isEmptyRecipient(recipient: Recipient | null): boolean {
  if (!recipient) return true;
  if (recipient.type === "individual") return recipient.number.replace(/\D/g, "") === "";
  return recipient.groupId === "";
}

function AlertHistoryRow({ entry }: { entry: AlertHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <div className="flex-between">
        <div>
          <div className="font-semibold">{entry.summary}</div>
          <div className="fs-075 text-muted mt-015">
            {formatDateTime(entry.sentAt)} ({formatRelativeTime(entry.sentAt)})
          </div>
        </div>
        <button className="btn-icon btn-icon-sm" onClick={() => setExpanded((prev) => !prev)} title="Ver mensagem completa">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {expanded && (
        <pre className="fs-082 mt-075" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
          {entry.message}
        </pre>
      )}
    </div>
  );
}

export function AlertsPanel() {
  const { jobs, refreshJobs } = useAppData();
  const { config, save: saveCriteria } = useAlertCriteria();
  const { history, refresh: refreshHistory } = useAlertHistory();
  const { recipient, save: saveRecipient } = useRecipient("alert-recipient");
  const { groups, connected: groupsConnected, isLoading: isLoadingGroups, refresh: refreshGroups } = useWhatsAppGroups();
  const statusOptions = useStatusOptions();

  const job = jobs.find((j) => j.id === ALERT_JOB_ID) ?? null;

  const [statuses, setStatuses] = useState<string[]>([]);
  const [levelMin, setLevelMin] = useState("");
  const [levelMax, setLevelMax] = useState("");
  const [notifyOnFill, setNotifyOnFill] = useState(false);
  const [notifyOnResolve, setNotifyOnResolve] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState<Recipient | null>(null);

  useEffect(() => {
    setStatuses(config.criteria.statuses ?? []);
    setLevelMin(config.criteria.levelMin !== undefined ? String(config.criteria.levelMin) : "");
    setLevelMax(config.criteria.levelMax !== undefined ? String(config.criteria.levelMax) : "");
    setNotifyOnFill(config.notifyOnFill);
    setNotifyOnResolve(config.notifyOnResolve);
  }, [config]);

  useEffect(() => {
    if (recipient) setRecipientDraft(recipient);
  }, [recipient]);

  const buildConfig = (): AlertTriggerConfig => ({
    criteria: {
      statuses: statuses.length > 0 ? statuses : undefined,
      levelMin: levelMin !== "" ? Number(levelMin) : undefined,
      levelMax: levelMax !== "" ? Number(levelMax) : undefined
    },
    notifyOnFill,
    notifyOnResolve
  });

  const saveCriteriaAction = useApiAction((value: AlertTriggerConfig) => saveCriteria(value), {
    success: () => ({ title: "Critério de alerta salvo", message: "As próximas checagens usam este critério." }),
    error: () => ({ title: "Erro de comunicação", message: "Não foi possível salvar o critério de alerta." })
  });

  const saveRecipientAction = useApiAction((value: Recipient) => saveRecipient(value), {
    success: () => ({ title: "Destinatário atualizado", message: "Os próximos alertas vão para este destinatário." }),
    error: (err) =>
      err instanceof ApiError && err.status === 400
        ? { title: "Destinatário inválido", message: "Informe um número válido (com DDI e DDD) ou selecione um grupo." }
        : { title: "Erro de comunicação", message: "Não foi possível salvar o destinatário." }
  });

  const runNowAction = useApiAction(
    async () => {
      await apiPost<{ ok: boolean }>(`/api/jobs/${ALERT_JOB_ID}/run`);
      await Promise.all([refreshJobs(), refreshHistory()]);
    },
    {
      pending: () => ({ title: "Verificando agora...", message: "Consultando a API e comparando com o último estado conhecido." }),
      success: () => ({ title: "Verificação concluída", message: "Confira o histórico abaixo se algo novo foi detectado." }),
      error: () => ({ title: "Falha na verificação", message: "Não foi possível rodar a checagem agora." })
    }
  );

  const isRecipientDirty = JSON.stringify(recipientDraft) !== JSON.stringify(recipient);
  const isCriteriaDirty = JSON.stringify(buildConfig()) !== JSON.stringify(config);

  return (
    <div className="section-stack">
      <div className="card">
        <div className="flex-between mb-125">
          <div>
            <h2 className="card-title">
              <Bell size={20} color="var(--accent-blue)" />
              Alertas de Casos Críticos
            </h2>
            <p className="card-subtitle">
              Checagem a cada 10 minutos: só manda mensagem quando algo realmente muda dentro do escopo monitorado
              (mesma exclusão + filtro salvo do relatório das 08:00). Sem repetir um caso que já foi avisado.
            </p>
          </div>

          <div className="flex-row gap-050">
            {job && (
              <span className={`pill ${job.enabled ? "pill-success" : "pill-neutral"}`}>
                {job.enabled ? "Ativo" : "Desativado"}
              </span>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void runNowAction.run()}
              disabled={runNowAction.isPending || job?.isRunning}
            >
              {runNowAction.isPending || job?.isRunning ? <RotateCw size={14} className="spinner" /> : <Play size={14} />}
              Verificar agora
            </button>
          </div>
        </div>

        {job && (
          <p className="fs-082 text-muted">
            {job.enabled && job.nextRun
              ? `Próxima checagem automática: ${formatDateTime(job.nextRun)} (${formatRelativeTime(job.nextRun)})`
              : "Job desativado — ligue-o na aba Jobs para as checagens automáticas voltarem a rodar."}
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Critério de alerta</h3>
        <p className="card-subtitle">
          O que dentro do escopo monitorado é grave o suficiente pra virar um alerta. Deixe tudo desmarcado e os dois
          toggles desligados pra manter o monitoramento sem enviar nada.
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
            {statuses.length === 0 && <span className="multiselect-hint">Nenhum marcado = qualquer status</span>}
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
        </div>

        <div className="flex-row-wrap gap-100 mt-075">
          <label className="flex-row gap-035">
            <input type="checkbox" checked={notifyOnFill} onChange={(e) => setNotifyOnFill(e.target.checked)} />
            Avisar de novo abastecimento
          </label>
          <label className="flex-row gap-035">
            <input type="checkbox" checked={notifyOnResolve} onChange={(e) => setNotifyOnResolve(e.target.checked)} />
            Avisar quando um caso se resolve
          </label>
        </div>

        <button
          className="btn btn-primary btn-sm mt-100"
          onClick={() => void saveCriteriaAction.run(buildConfig())}
          disabled={saveCriteriaAction.isPending || !isCriteriaDirty}
        >
          <Save size={14} className={saveCriteriaAction.isPending ? "spinner" : ""} />
          {saveCriteriaAction.isPending ? "Salvando..." : "Salvar critério"}
        </button>
      </div>

      <div className="card">
        <div className="flex-row gap-085 mb-100">
          <div className="wa-header-icon wa-header-icon-inactive">
            <Send size={24} />
          </div>
          <div>
            <h2 className="wa-title">Destinatário dos Alertas</h2>
            <p className="wa-subtitle">
              Número de WhatsApp ou grupo que recebe os alertas de casos críticos. Se não configurado, usa o mesmo
              destinatário do relatório diário.
            </p>
          </div>
        </div>

        <RecipientPicker
          value={recipientDraft}
          onChange={setRecipientDraft}
          groups={groups}
          groupsConnected={groupsConnected}
          isLoadingGroups={isLoadingGroups}
          onRefreshGroups={() => void refreshGroups()}
        />

        <button
          className="btn btn-primary btn-sm mt-075"
          onClick={() => recipientDraft && void saveRecipientAction.run(recipientDraft)}
          disabled={saveRecipientAction.isPending || !isRecipientDirty || isEmptyRecipient(recipientDraft)}
        >
          <CheckCircle2 size={15} className={saveRecipientAction.isPending ? "spinner" : ""} />
          {saveRecipientAction.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div>
        <h3 className="card-title mb-075">
          <History size={18} color="var(--brand-primary)" />
          Histórico de alertas ({history.length})
        </h3>

        {history.length === 0 ? (
          <div className="card">
            <p className="card-subtitle">Nenhum alerta enviado ainda.</p>
          </div>
        ) : (
          <div className="section-stack">
            {history.map((entry) => (
              <AlertHistoryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
