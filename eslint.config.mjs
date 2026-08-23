// ESLint flat config compartilhada pelos dois workspaces (backend e frontend).
// Um único arquivo na raiz é suficiente para o tamanho atual do monorepo — evita
// duplicar a mesma config duas vezes (um `eslint.config.js` por workspace não
// traria nenhum benefício aqui, só manutenção dobrada).
import { fileURLToPath } from "node:url";
import path from "node:path";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "storage/**", "releases/**"]
  },

  // Regras base de TypeScript (type-aware) para todo o código-fonte TS/TSX.
  // `projectService` deixa o typescript-eslint descobrir automaticamente o
  // tsconfig.json mais próximo de cada arquivo (backend/tsconfig.json para
  // backend/src, frontend/tsconfig.json para frontend/src) em vez de precisar
  // apontar dois `project` fixos manualmente.
  {
    files: ["backend/src/**/*.ts", "frontend/src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      // O código já usa `void promise()` deliberadamente para marcar fire-and-forget
      // (ex.: jobs/scheduler.ts, hooks de polling) — permitir esse padrão em vez de
      // forçar `await` em todo lugar.
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  },

  // Backend: Node.js (CommonJS, target ES2022).
  {
    files: ["backend/src/**/*.ts"],
    languageOptions: {
      globals: globals.node
    }
  },

  // Frontend: React 18 + Vite (navegador, JSX automático).
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    extends: [reactPlugin.configs.flat.recommended, reactPlugin.configs.flat["jsx-runtime"]],
    plugins: {
      "react-hooks": reactHooksPlugin
    },
    languageOptions: {
      globals: globals.browser
    },
    settings: {
      react: { version: "detect" }
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Tipagem de props já é feita via TypeScript (`interface XProps`), não faz
      // sentido também exigir PropTypes em runtime.
      "react/prop-types": "off"
    }
  },

  // Desliga qualquer regra de formatação do ESLint que brigaria com o Prettier
  // (aspas, ponto e vírgula, indentação, etc. ficam só a cargo do Prettier).
  eslintConfigPrettier
);
