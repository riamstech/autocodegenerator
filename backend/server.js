const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', function connection(ws) {
  console.log('WebSocket client connected');
  clients.push(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients = clients.filter(client => client !== ws);
  });
});

app.use(cors());
app.use(bodyParser.json());

app.post('/action', (req, res) => {
  const data = req.body;

  // You can add custom validation here if needed.
  // For now, accept any fields.

  // Add timestamp
  const payload = {
    timestamp: new Date().toISOString(),
    ...data
  };

  console.log('Broadcasting action:', payload);

  // Broadcast to all connected WebSocket clients
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  });

  res.status(200).json({ message: 'Action broadcasted', data: payload });
});

// Start server
const PORT = 3003;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
