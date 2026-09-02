import type { Logger } from "pino";
import type { JobDefinition } from "./scheduler";
import { runDailyReport } from "../services/reports";
import { checkForCriticalUpdates } from "../services/reports/monitor";
import { runCriticalLevelsSummary } from "../services/reports/dailySummary";

export function createJobDefinitions(_logger: Logger): JobDefinition[] {
  return [
    {
      id: "relatorio-diario",
      name: "Relatório diário 08:00",
      cronExpression: "0 8 * * *",
      run: runDailyReport
    },
    {
      id: "alertas-criticos",
      name: "Verificação de casos críticos (10 em 10 min)",
      cronExpression: "*/10 * * * *",
      run: checkForCriticalUpdates
    },
    {
      // 08:30, e não 08:00, para não disputar a API da Otodata com o
      // "relatorio-diario" acima — os dois batem na mesma API e rodavam
      // no mesmo minuto.
      id: "resumo-critico-diario",
      name: "Resumo diário — nível alto e baixo (08:30)",
      cronExpression: "30 8 * * *",
      run: runCriticalLevelsSummary
    },
    {
      // TEMPORÁRIO — 2ª rodada do teste do agendador, agora com o `sharp`
      // instalado: a 1ª provou que o cron dispara sozinho, mas as imagens saíam
      // sem miniatura porque nenhuma biblioteca de imagem existia no container.
      //
      // DESLIGAR assim que confirmar texto + as 2 imagens chegando: botão de
      // ativar/desativar na aba Jobs, ou remover esta entrada e publicar.
      id: "teste-agendador-2min",
      name: "TESTE — relatório a cada 2 min (desligar após o teste)",
      cronExpression: "*/2 * * * *",
      run: runDailyReport
    }
  ];
}
