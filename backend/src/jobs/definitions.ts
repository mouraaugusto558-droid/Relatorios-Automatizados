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
      // TEMPORÁRIO — existe só para provar que o agendador dispara sozinho, sem
      // ninguém clicar em nada. Manda o relatório diário completo (texto + as duas
      // imagens da planilha) a cada 2 minutos.
      //
      // DESLIGAR depois de confirmar: basta o botão de ativar/desativar na aba Jobs.
      // Deixar isso rodando manda ~30 mensagens iguais por hora para o mesmo
      // destino, o que é o padrão que o WhatsApp usa para marcar número como spam
      // (risco de perder a sessão), e bate na API da Otodata a cada 2 min.
      id: "teste-agendador-2min",
      name: "TESTE — relatório a cada 2 min (desligar após o teste)",
      cronExpression: "*/2 * * * *",
      run: runDailyReport
    }
  ];
}
