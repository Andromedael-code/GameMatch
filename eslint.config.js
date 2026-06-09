import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const browserGlobals = {
  AbortController: "readonly",
  Element: "readonly",
  Event: "readonly",
  HTMLElement: "readonly",
  Image: "readonly",
  React: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  console: "readonly",
  document: "readonly",
  fetch: "readonly",
  navigator: "readonly",
  performance: "readonly",
  window: "readonly",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}", "*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: browserGlobals,
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];
