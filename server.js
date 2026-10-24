const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 100000 });
app.use(express.static(path.join(__dirname, 'public')));
const rooms = new Map();
function cleanRoom(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
io.on('connection', socket => {
  socket.on('join-room', ({ room, name } = {}, callback = () => {}) => {
    room = cleanRoom(room); name = String(name || 'Computer').slice(0, 32);
    if (room.length < 4) return callback({ ok: false, error: 'Room code must be at least 4 characters.' });
    for (const r of socket.rooms) if (r !== socket.id) { socket.leave(r); if (rooms.has(r)) { rooms.get(r).delete(socket.id); io.to(r).emit('room-count', rooms.get(r).size); } }
    socket.join(room); socket.data.room = room; socket.data.name = name;
    if (!rooms.has(room)) rooms.set(room, new Map());
    rooms.get(room).set(socket.id, name);
    socket.to(room).emit('peer-status', { name, connected: true });
    io.to(room).emit('room-count', rooms.get(room).size);
    callback({ ok: true, room, count: rooms.get(room).size });
  });
  socket.on('clipboard-text', ({ text } = {}) => {
    const room = socket.data.room;
    if (!room || typeof text !== 'string' || text.length > 50000) return;
    socket.to(room).emit('clipboard-text', { text, from: socket.data.name || 'Another computer', sentAt: Date.now() });
  });
  socket.on('disconnect', () => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const members = rooms.get(room); members.delete(socket.id);
    socket.to(room).emit('peer-status', { name: socket.data.name || 'Computer', connected: false });
    io.to(room).emit('room-count', members.size); if (!members.size) rooms.delete(room);
  });
});
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => console.log(`ClipShare running at http://localhost:${port}`));
