import express from 'express';
import type { Response } from 'express';
import prisma from '../prisma/client.ts';
import { authenticate } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

const router = express.Router();

router.use(authenticate);

// GET /api/documents - get all documents
router.get('/', async (req: AuthRequest, res: Response) => {
  const documents = await prisma.document.findMany({
    where: { ownerId: req.userId },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(documents);
});

// GET /api/documents/:id - get one document
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const document = await prisma.document.findUnique({
    where: { id: parseInt(id), ownerId: req.userId }
  });
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(document);
});

// POST /api/documents - create a document
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, content } = req.body;
  const document = await prisma.document.create({
    data: {
      title: title || 'Untitled Document',
      content: content || '',
      ownerId: req.userId as number
    }
  });
  res.status(201).json(document);
});

// PUT /api/documents/:id - update a document
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content } = req.body;
  const document = await prisma.document.update({
    where: { id: parseInt(id), ownerId: req.userId },
    data: { title, content }
  });
  res.json(document);
});

// DELETE /api/documents/:id - delete a document
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  await prisma.document.delete({
    where: { id: parseInt(id), ownerId: req.userId }
  });
  res.json({ message: 'Document deleted' });
});

export default router;