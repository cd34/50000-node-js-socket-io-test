const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const geoip = require('geoip-lite');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(handler);
const io = new Server(server, {
  transports: ['websocket', 'polling']
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
});

const countryCounts = {};

function handler(req, res) {
  fs.readFile(__dirname + '/index.html', (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
}

function getCountryArray() {
  const result = [];
  for (const [code, count] of Object.entries(countryCounts)) {
    if (count > 0) {
      result.push([code, count]);
    }
  }
  return result;
}

function getClientIP(socket) {
  return socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim()
    || socket.handshake.address;
}

function getCountryCode(socket) {
  const address = getClientIP(socket);
  const geo = geoip.lookup(address);
  return geo ? geo.country : null;
}

io.on('connection', (socket) => {
  const country = getCountryCode(socket);
  if (country) {
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  }

  const connectionCount = io.engine.clientsCount;
  io.emit('50k', { watchers: connectionCount });
  io.emit('country', { graph: getCountryArray() });

  socket.on('disconnect', () => {
    if (country) {
      countryCounts[country] = Math.max((countryCounts[country] || 0) - 1, 0);
    }
    const connectionCount = io.engine.clientsCount;
    io.emit('50k', { watchers: connectionCount });
    io.emit('country', { graph: getCountryArray() });
  });
});
