import express from 'express';
import type { Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { pubClient as redis } from '../index.js';

const router = express.Router();
router.use(authenticate);

const CACHE_TTL = 60;

// GET /api/documents - get all documents
router.get('/', async (req: AuthRequest, res: Response) => {
  const cacheKey = `documents:user:${req.userId}`;

  const cached = await redis.get(cacheKey) as string | null;
  if (cached !== null) {
    res.json(JSON.parse(cached));
    return;
  }

  const [ownedDocuments, sharedDocuments] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: req.userId },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.document.findMany({
      where: { shares: { some: { userId: req.userId } } },
      orderBy: { updatedAt: 'desc' }
    })
  ]);

  const result = {
    owned: ownedDocuments,
    shared: sharedDocuments
  };

  await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
  res.json(result);
});

// GET /api/documents/:id - get one document
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const cacheKey = `document:${id}:user:${req.userId}`;

  const cached = await redis.get(cacheKey) as string | null;
  if (cached !== null) {
    res.json(JSON.parse(cached));
    return;
  }

  const document = await prisma.document.findFirst({
    where: {
      id: parseInt(id),
      OR: [
        { ownerId: req.userId },
        { shares: { some: { userId: req.userId } } }
      ]
    }
  });

  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(document));
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

  await redis.del(`documents:user:${req.userId}`);
  res.status(201).json(document);
});

// PUT /api/documents/:id - update with conflict detection
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content, baseVersion } = req.body;

  const current = await prisma.document.findUnique({
    where: { id: parseInt(id), ownerId: req.userId }
  });

  if (!current) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (baseVersion !== undefined && baseVersion !== current.version) {
    res.status(409).json({
      error: 'Conflict: document was modified elsewhere',
      serverVersion: current.version,
      serverTitle: current.title,
      serverContent: current.content,
    });
    return;
  }

  const document = await prisma.document.update({
    where: { id: parseInt(id), ownerId: req.userId },
    data: { title, content, version: { increment: 1 } }
  });

  await redis.del(`document:${id}:user:${req.userId}`);
  await redis.del(`documents:user:${req.userId}`);

  res.json(document);
});

// DELETE /api/documents/:id - delete a document
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  await prisma.document.delete({
    where: { id: parseInt(id), ownerId: req.userId }
  });

  await redis.del(`document:${id}:user:${req.userId}`);
  await redis.del(`documents:user:${req.userId}`);

  res.json({ message: 'Document deleted' });
});

export default router;