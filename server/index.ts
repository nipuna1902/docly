import express from 'express';
import cors from 'cors';
import documentRoutes from './routes/documents.ts';
import authRoutes from './routes/auth.ts';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.use('/api/documents', documentRoutes);
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});