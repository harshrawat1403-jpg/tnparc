# Training & Placement Portal

### Department of Architecture & Planning

### Visvesvaraya National Institute of Technology (VNIT), Nagpur

Official Training & Placement (TNP) web portal for the Department of Architecture & Planning, VNIT Nagpur.

---

## Current Status: Phase 1 — Repository Foundation Complete

- **Next.js:** 16.4.2 (App Router with Turbopack)
- **React:** 19.3.0
- **TypeScript:** Strict configuration enabled
- **Tailwind CSS:** v4 with institutional placeholder design tokens
- **Supabase CLI:** Scaffold initialized (zero migrations or database schema applied in Phase 1)
- **Routes:** 8 static public pages (`/`, `/about`, `/placements`, `/internships`, `/for-recruiters`, `/contact`, `/login`, `/signup`)
- **Accessibility:** WCAG 2.1 AA compliant foundation (Skip to content, visible focus rings, semantic markup, responsive at 375px)

> [!NOTE]
> Database migrations, Supabase Auth, protected role-based dashboards, and application workflows are scheduled for subsequent phases as defined in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Getting Started

### Prerequisites

- Node.js `v20+` (developed on `v24.16.0`)
- npm `v10+` (developed on `11.13.0`)

### Installation & Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run TypeScript type check
npm run typecheck

# Run ESLint
npm run lint

# Check formatting
npm run format:check

# Run production build
npm run build
```

---

## Project Structure

```
├── docs/                   # System specifications and architectural design
│   └── ARCHITECTURE.md     # Frozen Phase 0 architecture document (v1.0)
├── public/                 # Static public assets
│   └── images/             # Department image assets (.gitkeep)
├── src/
│   ├── app/                # Next.js App Router static public pages
│   ├── components/
│   │   ├── layout/         # Header, Footer, Logo, SkipToContent
│   │   └── ui/             # Reusable accessible UI components
│   ├── styles/             # Design tokens and CSS
│   └── types/              # TypeScript types mirroring system enums
└── supabase/               # Supabase CLI local scaffolding (seed & config only)
```

---

## Architectural Specification

Refer to [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the complete multi-phase architecture, database schema, security model, and implementation roadmap.
