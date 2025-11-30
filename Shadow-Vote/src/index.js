/**
 * Lightweight Express server that simulates the HashRegistry contract behavior locally.
 * This allows you to run and test the voting flow (Option A) without doing a full Midnight
 * environment setup. The server stores "seen" hashes in target/state.json.
 *
 * Endpoints:
 *  POST /vote      { "hash": "<hex-or-string>" }   -> { "already": bool }
 *  GET  /isSeen/:hash                           -> { "seen": bool }
 *  GET  /health                                  -> { "ok": true }
 *
 * To run:
 *  npm install
 *  npm run dev
 *
 * NOTE: This simulates the contract. For real Midnight integration, compile the contract with compactc
 * and replace the local logic with calls to the compiled contract and Midnight proof server.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const DATA_DIR = path.join(__dirname, '..', 'target');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ seen: {} }, null, 2));
}

const loadState = () => {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
};
const saveState = (state) => {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

const app = express();
app.use(bodyParser.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/vote', (req, res) => {
    const h = req.body.hash;
    if (!h || typeof h !== 'string') {
        return res.status(400).json({ error: 'missing or invalid "hash" in body' });
    }
    const state = loadState();
    const already = !!state.seen[h];
    if (already) {
        return res.json({ already: true, message: 'Already voted' });
    }
    // store
    state.seen[h] = true;
    saveState(state);
    return res.json({ already: false, message: 'Vote stored' });
});

app.get('/isSeen/:hash', (req, res) => {
    const h = req.params.hash;
    const state = loadState();
    res.json({ seen: !!state.seen[h] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Smart Voting (simulated) server listening on port', PORT);
});
