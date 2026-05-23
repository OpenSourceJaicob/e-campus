const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const activeWorlds = new Map();

console.log(`JaicobLand Network Relay boot sequence complete. Listening on port ${PORT}`);

wss.on('connection', (ws) => {
  let currentWorldId = null;
  let isHost = false;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', players: activeWorlds.size }));
        return;
      }

      if (data.type === 'register') {
        currentWorldId = Math.random().toString(36).substring(2, 9).toUpperCase();
        isHost = true;
        
        activeWorlds.set(currentWorldId, { hostSocket: ws, peers: new Set() });
        ws.send(JSON.stringify({ type: 'registered', worldId: currentWorldId }));
        console.log(`[WORLD CREATED] ID: ${currentWorldId}`);
        return;
      }

      if (data.type === 'join') {
        const worldId = data.worldId?.toUpperCase();
        const world = activeWorlds.get(worldId);

        if (!world) {
          ws.send(JSON.stringify({ type: 'error', message: 'World not found or expired' }));
          return;
        }

        currentWorldId = worldId;
        world.peers.add(ws);
        
        world.hostSocket.send(JSON.stringify({ type: 'peer_joined', peerId: data.peerId }));
        console.log(`[PLAYER JOINING] Connecting to World: ${worldId}`);
        return;
      }

      if (data.type === 'signal') {
        const world = activeWorlds.get(currentWorldId);
        if (!world) return;

        if (isHost) {
          for (let peer of world.peers) {
            if (peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify(data));
            }
          }
        } else {
          if (world.hostSocket.readyState === WebSocket.OPEN) {
            world.hostSocket.send(JSON.stringify(data));
          }
        }
      }

    } catch (err) {
    }
  });

  ws.on('close', () => {
    if (isHost && currentWorldId) {
      console.log(`[WORLD CLOSED] ID: ${currentWorldId}`);
      activeWorlds.delete(currentWorldId);
    } else if (currentWorldId) {
      const world = activeWorlds.get(currentWorldId);
      if (world) {
        world.peers.delete(ws);
      }
    }
  });
});