<div align="center">

# ChatApp — Real-Time Messaging Platform

A full-stack, low-latency messaging platform built with Next.js 16, Bun, PostgreSQL (Drizzle ORM), and Socket.IO.  
Hosted 24/7 with zero sleep timers on Oracle Cloud Always Free Infrastructure and Vercel.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16.2-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-20232a?style=flat-square&logo=react)](https://react.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.4+-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-316192?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.45-C5F74F?style=flat-square&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat-square&logo=socket.io)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[![Oracle Cloud](https://img.shields.io/badge/Oracle_Cloud-Always_Free_VPS-F80000?style=flat-square&logo=oracle&logoColor=white)](https://www.oracle.com/cloud/free/)
[![Coolify](https://img.shields.io/badge/Coolify-Self--Hosted_PaaS-6B21A8?style=flat-square&logo=docker&logoColor=white)](https://coolify.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Managed_Postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Edge_CDN-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

<br/>
<br/>

**[ 🚀 Live Demo ](https://chat-application-mocha-xi.vercel.app)** &nbsp;•&nbsp; **[ ⚡ API Health Check ](https://130.210.55.231.sslip.io/health)** &nbsp;•&nbsp; **[ 🧪 Run Tests ](#testing)** &nbsp;•&nbsp; **[ 📦 Quickstart ](#getting-started)** &nbsp;•&nbsp; **[ 🏗️ Architecture ](#architecture--engineering-decisions)**

<br/>
<br/>

<img src="./preview.png" alt="ChatApp Live Interface Preview" width="880" style="border-radius: 8px; border: 1px solid #334155; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />

</div>

---

## Overview

Most real-time chat side-projects either rely on expensive third-party wrappers (Pusher, Firebase) or suffer from free-tier cold-starts (where platforms like Render or Railway sleep after 15 minutes of inactivity, causing 30–50 second lag on waking).

I built **ChatApp** to solve this problem from first principles: a modern, decoupled messaging platform with sub-200ms round-trip latency, full relational data integrity, optimistic UI updates, and automated storage retention—hosted on dedicated Always Free cloud infrastructure without monthly hosting bills or sleep timers.

---

## Key Features

### 1. Real-Time Communication & Messaging
- **1-on-1 Direct & Multi-User Groups**: Start instant direct chats or create named group channels with dynamic participant lists.
- **Room-Scoped Event Broadcasting**: Sockets join isolated conversation rooms (`conv_${conversationId}`) rather than polluting the global namespace.
- **Optimistic UI Dispatch**: Messages render locally with a temporary ID and transition to double checkmarks (`✓✓`) as soon as the server acknowledges the write.
- **Delivery & Read Receipts**: Real-time read synchronization across all participants when a chat is opened.
- **Ephemeral State**: Debounced typing indicators (`user_typing` / `user_stop_typing`) and multi-device/multi-tab online presence tracking.

### 2. Data Lifecycle & Maintenance
- **Message Deletion ("Delete for Everyone")**: Hover over any sent message to delete it from the database and broadcast the removal to all clients in real time.
- **Clear Chat History**: Empty conversation history while keeping the conversation room active.
- **Conversation Deletion**: Remove conversations completely, with PostgreSQL `ON DELETE CASCADE` automatically cleaning up participants, messages, and read receipts.
- **Automated Storage Retention**: Built-in CLI pruner (`bun run cleanup`) and secured admin API endpoint to purge stale test data and enforce retention policies.

### 3. Security & Validation
- **Stateless Authentication**: JWT tokens with bcrypt password hashing and salting.
- **Socket Handshake Auth**: WebSocket connection upgrades are authenticated via JWT before socket session allocation.
- **Input Sanitization**: Defensive validation on usernames, passwords, and message payloads with custom HTTP error middleware.

---

## Architecture & Engineering Decisions

```mermaid
flowchart TB
    subgraph Client["Frontend Client (Vercel Edge CDN)"]
        UI["Next.js 16 App Router + React 19\nTailwind CSS Dark Theme (WhatsApp/Telegram Aesthetic)\nStateful Socket.IO Client + Optimistic UI"]
    end

    subgraph Infrastructure["Compute & Reverse Proxy (Oracle Cloud VPS)"]
        Caddy["Caddy / Traefik Reverse Proxy (SSL Termination)"]
        Docker["Docker CE Container (oven/bun:1-slim)"]
        Express["Express 5 REST API Router"]
        SocketEngine["Socket.IO Real-Time Engine"]
        Drizzle["Drizzle ORM 0.45 (Zero-Overhead SQL Builder)"]
    end

    subgraph Database["Managed Cloud Database (Supabase)"]
        Pooler["Supabase IPv4 Connection Pooler (:6543)"]
        Postgres[("PostgreSQL 15+\n- Foreign Keys with ON DELETE CASCADE\n- Compound Cursor Index: (conversation_id, created_at)")]
    end

    UI -->|"HTTPS Static Delivery"| Client
    UI -->|"REST API Requests"| Caddy
    UI <-->|"Bi-directional WebSockets"| Caddy
    
    Caddy --> Docker
    Docker --> Express
    Docker --> SocketEngine
    Express --> Drizzle
    SocketEngine --> Drizzle
    Drizzle --> Pooler
    Pooler --> Postgres
```

### Why these technical choices?

| Decision | Alternative Considered | Engineering Rationale |
| :--- | :--- | :--- |
| **Bun 1.4+ Runtime** | Node.js / ts-node | Instant cold starts, native TypeScript execution without build steps, built-in fast test runner (`bun test`), and lower memory footprint. |
| **PostgreSQL + Drizzle** | MongoDB + Mongoose | MongoDB arrays for read receipts risk unbounded document growth. PostgreSQL provides foreign keys with `ON DELETE CASCADE`, composite B-tree indexes, and compile-time type safety via Drizzle ORM. |
| **Compound Indexing** | Offset pagination (`skip/limit`) | Added index on `(conversation_id, created_at)`. Allows cursor-based queries to seek directly to the latest messages in $\mathcal{O}(\log N)$ time, avoiding slow table scans. |
| **3-Tier LLD Architecture** | Monolithic route handlers | Separated into Controller $\to$ Service $\to$ Repository layers. Domain logic is decoupled from HTTP transport, making services mockable and unit-testable. |
| **Oracle Cloud Always Free** | Render / Railway / Fly.io | 4 Ampere ARM OCPUs, 24 GB RAM, 200 GB SSD. Completely eliminates the 15-minute sleep timer problem while costing $0.00/month. |

---

## Database Schema

```mermaid
erDiagram
    USERS ||--o{ CONVERSATION_PARTICIPANTS : "joins"
    USERS ||--o{ MESSAGES : "sends"
    USERS ||--o{ MESSAGE_READS : "acknowledges"
    CONVERSATIONS ||--o{ CONVERSATION_PARTICIPANTS : "has"
    CONVERSATIONS ||--o{ MESSAGES : "contains"
    MESSAGES ||--o{ MESSAGE_READS : "tracked by"

    USERS {
        uuid id PK
        varchar username UK
        text password
        timestamp created_at
        timestamp updated_at
    }

    CONVERSATIONS {
        uuid id PK
        boolean is_group
        varchar name
        uuid admin_id FK
        uuid last_message_id FK
        timestamp created_at
        timestamp updated_at
    }

    CONVERSATION_PARTICIPANTS {
        uuid conversation_id PK,FK
        uuid user_id PK,FK
        timestamp joined_at
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        varchar sender_name
        text text
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    MESSAGE_READS {
        uuid message_id PK,FK
        uuid user_id PK,FK
        timestamp read_at
    }
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (v1.4 or later)
- PostgreSQL database (local or cloud instance via [Supabase](https://supabase.com))

### 1. Clone the repository
```bash
git clone https://github.com/abhishekgupta1025/chat-application.git
cd chat-application
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env` with your credentials:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:[password]@[host]:6543/postgres?sslmode=require
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:3000
```

Push database schema & start server:
```bash
# Push schema migrations to PostgreSQL
bun run db:push

# Start development server (with hot reload)
bun run dev
```
Backend will start on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
bun install

# Configure environment variables
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:5000" > .env.local

# Start Next.js development server
bun run dev
```
Open `http://localhost:3000` in your browser.

---

## Storage Maintenance & Retention Scripts

To keep database storage lean on free-tier limits, run the built-in maintenance utilities from `backend/`:

```bash
# Purge automated test accounts (alpha_*, test_*) and orphaned chats
bun run cleanup

# Apply a 30-day message retention policy
bun run cleanup:30days

# Complete message reset for fresh benchmarking
bun run cleanup:all
```

Alternatively, trigger cleanup over HTTP:
```bash
curl -X POST http://localhost:5000/api/admin/cleanup \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your_jwt_secret_key" \
  -d '{"days": 30}'
```

---

## Testing

The project includes unit, integration, and live WebSocket test suites:

```bash
cd backend
bun test
```

```text
 26 pass
 0 fail
 70 expect() calls
Ran 26 tests across 6 files. [100% pass rate]
```

---

## Deployment Architecture

- **Frontend**: Hosted on **Vercel** with automatic Git deployments and global Edge CDN caching.
- **Backend**: Containerized via Docker (`oven/bun:1-slim`) and managed through **Coolify** on an **Oracle Cloud Always Free VM** (Ubuntu 24.04 LTS, 4 ARM OCPUs, 24 GB RAM).
- **Database**: **Supabase Managed PostgreSQL** connected over IPv4 pooler transaction mode.

---

## License

Distributed under the [MIT License](LICENSE).
