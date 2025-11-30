# Smart Voting (Option A) - Ready project (Simulated runtime)

This repository contains a **complete, ready-to-run** project for **Option A** (duplicate-vote prevention).
It **simulates** the Midnight HashRegistry contract locally so you don't need to install or set up the full Midnight toolchain.

## What this package includes
- `contracts/hashregistry.compact` — The compact contract source (canonical).
- `src/index.js` — Express server that **simulates** contract behavior using a local JSON state file.
- `target/state.json` — (created at runtime) persistent storage for `seen` hashes.
- `Dockerfile` + `docker-compose.yml` — Run the server inside Docker.
- `package.json` — scripts including `compile-contract` which uses the official `midnightnetwork/compactc` Docker image (if you want to compile).

## Quick start (no Midnight, just run)
1. Install Docker and Node.js (if you don't want Docker).
2. From the project folder:
   ```bash
   npm install
   npm run dev
   ```
   or using Docker Compose:
   ```bash
   docker compose up --build
   ```
3. API endpoints:
   - `POST /vote`  with JSON body `{ "hash": "<unique-hash>" }`
     - returns `{ "already": true }` if duplicate, `{ "already": false }` if stored
   - `GET /isSeen/:hash` returns `{ "seen": true|false }`
   - `GET /health` returns `{ "ok": true }`

## To compile the contract with compactc (optional)
If you want to compile the contract with Midnight's compiler:
```bash
npm run compile-contract
```
This runs:
```
docker run --rm -v "${PWD}:/app" midnightnetwork/compactc:latest compactc /app/contracts/hashregistry.compact /app/target
```
After compilation, `target/` will contain compiled artifacts from the compact compiler.

## How to replace the simulation with real Midnight integration
1. Compile the contract using `npm run compile-contract` (requires Docker).
2. Start Midnight proof server (depending on Midnight instructions).
3. Replace the logic in `src/index.js`:
   - Instead of reading `target/state.json`, call the compiled contract's query/transition using Midnight SDK/wallet.
   - Use the proof server endpoints to submit proofs/transitions.

## Notes
- This repo intentionally simulates the on-chain contract so you can *run, test, and share* the app easily without a specialized environment.
- For production or real zk proofs, integrate Midnight's runtime and proof server following Midnight docs.

