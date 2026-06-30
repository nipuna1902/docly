import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import documentRoutes from './routes/documents.ts';
import authRoutes from './routes/auth.ts';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.use('/api/documents', documentRoutes);
app.use('/api/auth', authRoutes);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
  },
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

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});