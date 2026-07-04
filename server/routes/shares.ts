import express from 'express';
import type { Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// POST /api/shares/:documentId - share a document with a user by email
router.post('/:documentId', async (req: AuthRequest, res: Response) => {
  const documentId = parseInt(req.params.documentId as string);
  const { email } = req.body;

  // Verify the requester owns this document
  const document = await prisma.document.findUnique({
    where: { id: documentId, ownerId: req.userId }
  });

  if (!document) {
    res.status(404).json({ error: 'Document not found or you are not the owner' });
    return;
  }

  // Find the user to share with
  const targetUser = await prisma.user.findUnique({
    where: { email }
  });

  if (!targetUser) {
    res.status(404).json({ error: 'No user found with that email' });
    return;
  }

  if (targetUser.id === req.userId) {
    res.status(400).json({ error: 'You cannot share a document with yourself' });
    return;
  }

  // Create the share (@@unique prevents duplicates)
  const share = await prisma.documentShare.upsert({
    where: { documentId_userId: { documentId, userId: targetUser.id } },
    update: {},
    create: { documentId, userId: targetUser.id, permission: 'edit' }
  });

  res.status(201).json({ message: `Document shared with ${email}`, share });
});

// GET /api/shares/:documentId - list who has access to a document
router.get('/:documentId', async (req: AuthRequest, res: Response) => {
  const documentId = parseInt(req.params.documentId as string);

  const document = await prisma.document.findUnique({
    where: { id: documentId, ownerId: req.userId }
  });

  if (!document) {
    res.status(404).json({ error: 'Document not found or you are not the owner' });
    return;
  }

  const shares = await prisma.documentShare.findMany({
    where: { documentId },
    include: { user: { select: { email: true, id: true } } }
  });

  res.json(shares);
});

// DELETE /api/shares/:documentId/:userId - revoke access
router.delete('/:documentId/:userId', async (req: AuthRequest, res: Response) => {
  const documentId = parseInt(req.params.documentId as string);
  const userId = parseInt(req.params.userId as string);

  const document = await prisma.document.findUnique({
    where: { id: documentId, ownerId: req.userId }
  });

  if (!document) {
    res.status(404).json({ error: 'Document not found or you are not the owner' });
    return;
  }

  await prisma.documentShare.delete({
    where: { documentId_userId: { documentId, userId } }
  });

  res.json({ message: 'Access revoked' });
});

export default router;