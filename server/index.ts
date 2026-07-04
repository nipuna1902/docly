import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import documentRoutes from './routes/documents.js';
import authRoutes from './routes/auth.js';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.use('/api/documents', documentRoutes);
app.use('/api/auth', authRoutes);

const httpServer = createServer(app);

// Redis clients — pub/sub requires two separate clients
const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173' }
});

// Connect Redis and attach adapter before starting server
Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis adapter connected');

  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-document', (documentId: string) => {
    socket.join(documentId);
    console.log(`Socket ${socket.id} joined document ${documentId}`);
  });

  socket.on('edit-document', ({ documentId, title, content }) => {
    socket.to(documentId).emit('document-updated', { title, content });
  });

  socket.on('document-saved', ({ documentId, version }) => {
    socket.to(documentId).emit('version-updated', { version });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

export { pubClient };