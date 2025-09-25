import js from "@eslint/js";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  perfectionist.configs["recommended-natural"],
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        sourceType: "module",
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          selector: "variableLike",
          trailingUnderscore: "allow",
        },
        {
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          selector: "property", // covers class properties/attributes
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "warn",
      "no-debugger": "warn",
      "no-undef": "off",
      "no-unused-vars": "off",
      "prefer-const": "error",
    },
  },
  {
    ignores: [
      "build/**",
      "node_modules/**",
      "coverage/**",
      "db/migrations/**",
      "jest.config.ts",
      "scripts/**/*",
    ],
  },
];
