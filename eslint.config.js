import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // Base recommended rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React hooks rules
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // setState in effects is valid for resetting derived state on prop changes
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Disable rules that conflict with Prettier
  prettier,

  // Project-specific overrides
  {
    rules: {
      // Allow unused vars prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow explicit any — this codebase uses it intentionally at API boundaries
      "@typescript-eslint/no-explicit-any": "off",
      // Regex character classes use [ legitimately; avoid false positives
      "no-useless-escape": "warn",
    },
  },

  // Ignore build output and generated files
  {
    ignores: ["node_modules/", ".output/", ".wxt/", "dist/", ".logic-review/output/"],
  },
);
