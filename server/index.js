import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT || 8080);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const reqPath = (req.url || '/').split('?')[0];
  let filePath = path.join(DIST_DIR, reqPath === '/' ? 'index.html' : reqPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('7 Wonders Duel WebSocket Server is running. Run `npm run build` to serve the web app.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

const wss = new WebSocketServer({ server });

/**
 * rooms: Map<roomCode, { players: [WebSocket | null, WebSocket | null], state: any }>
 */
const rooms = new Map();

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? makeRoomCode() : code;
}

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerIndex = -1;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.type === 'create_room') {
      const code = makeRoomCode();
      rooms.set(code, { players: [ws, null], state: data.state ?? null });
      currentRoom = code;
      playerIndex = 0;
      send(ws, { type: 'room_created', code, playerIndex: 0 });
    } else if (data.type === 'join_room') {
      const code = String(data.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: 'error', message: '방을 찾을 수 없습니다.' });
        return;
      }
      if (room.players[1]) {
        send(ws, { type: 'error', message: '방이 이미 가득 찼습니다.' });
        return;
      }
      room.players[1] = ws;
      currentRoom = code;
      playerIndex = 1;
      send(ws, { type: 'room_joined', code, playerIndex: 1, state: room.state });
      send(room.players[0], {
        type: 'opponent_joined',
        playerName: data.playerName || '상대 플레이어',
      });
    } else if (data.type === 'sync_state') {
      const room = currentRoom ? rooms.get(currentRoom) : null;
      if (!room) return;
      room.state = data.state;
      const other = room.players[playerIndex === 0 ? 1 : 0];
      send(other, { type: 'state_update', state: data.state });
    }
  });

  ws.on('close', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const other = room.players[playerIndex === 0 ? 1 : 0];
    send(other, { type: 'opponent_left' });
    rooms.delete(currentRoom);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`7 Wonders Duel server listening on http://0.0.0.0:${PORT}`);
});
