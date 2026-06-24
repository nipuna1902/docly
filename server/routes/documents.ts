import express from 'express';
import type { Request, Response } from 'express';
import prisma from '../prisma/client.ts';

const router = express.Router();

// GET /api/documents - get all documents
router.get('/', async (req: Request, res: Response) => {
  const documents = await prisma.document.findMany({
    orderBy: { updatedAt: 'desc' }
  });
  res.json(documents);
});

// GET /api/documents/:id - get one document
router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const document = await prisma.document.findUnique({
    where: { id: parseInt(id) }
  });
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(document);
});

// POST /api/documents - create a document
router.post('/', async (req: Request, res: Response) => {
  const { title, content } = req.body;
  const document = await prisma.document.create({
    data: {
      title: title || 'Untitled Document',
      content: content || ''
    }
  });
  res.status(201).json(document);
});

// PUT /api/documents/:id - update a document
router.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { title, content } = req.body;
  const document = await prisma.document.update({
    where: { id: parseInt(id) },
    data: { title, content }
  });
  res.json(document);
});

// DELETE /api/documents/:id - delete a document
router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.document.delete({
    where: { id: parseInt(id) }
  });
  res.json({ message: 'Document deleted' });
});

export default router;