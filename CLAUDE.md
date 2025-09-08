# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Keep changes small and focused one step at a time so that its easy to view the changes and that changes don't overhaul entire files in 1 pass.

## Project Overview

This is a Next.js App Router Course project - a dashboard application built with Next.js 15, TypeScript, Tailwind CSS, and PostgreSQL. The main application code is located in the `nextjs-dashboard/` subdirectory.

## Development Commands

All commands should be run from the `nextjs-dashboard/` directory:

```bash
cd nextjs-dashboard
```

- **Development server**: `pnpm dev` (uses Turbopack for faster builds)
- **Build**: `pnpm build`
- **Start production**: `pnpm start`

Note: This project uses pnpm as the package manager.

## Architecture

The application follows Next.js App Router conventions:

### Key Directories
- `app/` - Main application code using App Router
  - `dashboard/` - Dashboard pages (customers, invoices)
  - `lib/` - Shared utilities and data access layer
  - `ui/` - Reusable UI components organized by feature
  - `query/` & `seed/` - API routes for database operations

### Data Layer
- Database queries are centralized in `app/lib/data.ts`
- Uses `postgres` library for PostgreSQL connections
- Database connection expects `POSTGRES_URL` environment variable
- Type definitions in `app/lib/definitions.ts`

### UI Components
- Components organized by feature in `app/ui/`
- Uses Tailwind CSS with custom configuration
- Heroicons for icons
- Custom form styling with `@tailwindcss/forms`

### Authentication
- Uses NextAuth.js v5 (beta)
- Authentication logic integrated throughout the app

## Database Setup
The application requires a PostgreSQL database. Connection string should be provided via `POSTGRES_URL` environment variable with SSL enabled.