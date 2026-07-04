import express from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/auth.js';
import { pubClient as redis } from '../index.js';
const router = express.Router();
router.use(authenticate);
const CACHE_TTL = 60;
// GET /api/documents - get all documents
router.get('/', async (req, res) => {
    const cacheKey = `documents:user:${req.userId}`;
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
        res.json(JSON.parse(cached));
        return;
    }
    const documents = await prisma.document.findMany({
        where: { ownerId: req.userId },
        orderBy: { updatedAt: 'desc' }
    });
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(documents));
    res.json(documents);
});
// GET /api/documents/:id - get one document
router.get('/:id', async (req, res) => {
    const id = req.params.id;
    const cacheKey = `document:${id}:user:${req.userId}`;
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
        res.json(JSON.parse(cached));
        return;
    }
    const document = await prisma.document.findUnique({
        where: { id: parseInt(id), ownerId: req.userId }
    });
    if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
    }
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(document));
    res.json(document);
});
// POST /api/documents - create a document
router.post('/', async (req, res) => {
    const { title, content } = req.body;
    const document = await prisma.document.create({
        data: {
            title: title || 'Untitled Document',
            content: content || '',
            ownerId: req.userId
        }
    });
    await redis.del(`documents:user:${req.userId}`);
    res.status(201).json(document);
});
// PUT /api/documents/:id - update with conflict detection
router.put('/:id', async (req, res) => {
    const id = req.params.id;
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
router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    await prisma.document.delete({
        where: { id: parseInt(id), ownerId: req.userId }
    });
    await redis.del(`document:${id}:user:${req.userId}`);
    await redis.del(`documents:user:${req.userId}`);
    res.json({ message: 'Document deleted' });
});
export default router;
