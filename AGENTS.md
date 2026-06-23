# Agent Guidelines & Project Standards

## Core Tools

* Always use Bun for all operations.
* Use `bun install` to install dependencies.
* Run tasks using `bun run <script>`.
* Execute files natively with `bun <file>`.

## Tech Stack & Code Style

* Language: TypeScript (Strict mode preferred)
* Bun automatically loads `.env` files, do not use `dotenv`.
* Prefer Bun-native APIs over Node.js legacy modules.
* Always use 4 spaces `    ` instead of tab for spacing.

## Repository Rules

* Do not commit secrets.
* Always check `package.json` for available scripts before writing custom commands.
* Always check typescript and style with `bun run lint`.
