import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        // import: fixupPluginRules(_import),
        prettier,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
        },

        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    settings: {
        "import/parsers": {
            "@typescript-eslint/parser": [".ts"],
        },

        "import/resolver": {
            typescript: {
                alwaysTryTypes: true,
            },
        },
    },

    rules: {
        quotes: 0,
        "no-nested-ternary": 0,
        "@typescript-eslint/no-empty-function": 0,
        "@typescript-eslint/quotes": 0,
        "import/no-unresolved": 0,
        "no-console": 0,
        "no-param-reassign": 0,
        "import/no-cycle": 0,
        "jsx-a11y/label-has-associated-control": 0,
        "import/prefer-default-export": [0, {
            target: "any",
        }],
        "no-unused-expressions": [0, {
            allowTernary: true,
        }],
        "prettier/prettier": [0, {}, {
            usePrettierrc: true,
        }],
    },
}];