import { Router, Request, Response } from 'express';
import { ideasService } from '../services/ideas.js';
import type { ApiResponse, Idea, IdeaMeta } from '@catalyst/shared';

export const ideasRouter = Router();

ideasRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const ideas = await ideasService.list();
    res.json({ ok: true, data: ideas } satisfies ApiResponse<IdeaMeta[]>);
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message } satisfies ApiResponse);
  }
});

ideasRouter.post('/', async (req: Request, res: Response) => {
  const { title, content } = req.body as { title?: string; content?: string };
  if (!title || !content) {
    res.status(400).json({ ok: false, error: 'Title and content required' } satisfies ApiResponse);
    return;
  }

  try {
    await ideasService.ensureBasePath();
    const meta = await ideasService.create(title, content);
    res.status(201).json({ ok: true, data: meta } satisfies ApiResponse<IdeaMeta>);
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message } satisfies ApiResponse);
  }
});

ideasRouter.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const idea = await ideasService.get(req.params.idOrSlug as string);
    if (!idea) {
      res.status(404).json({ ok: false, error: 'Idea not found' } satisfies ApiResponse);
      return;
    }
    res.json({ ok: true, data: idea } satisfies ApiResponse<Idea>);
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message } satisfies ApiResponse);
  }
});

ideasRouter.patch('/:idOrSlug', async (req: Request, res: Response) => {
  const updates = req.body as Partial<Pick<IdeaMeta, 'title' | 'status' | 'sessionId'>>;
  try {
    const updated = await ideasService.update(req.params.idOrSlug as string, updates);
    if (!updated) {
      res.status(404).json({ ok: false, error: 'Idea not found' } satisfies ApiResponse);
      return;
    }
    res.json({ ok: true, data: updated } satisfies ApiResponse<IdeaMeta>);
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message } satisfies ApiResponse);
  }
});

ideasRouter.delete('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const deleted = await ideasService.delete(req.params.idOrSlug as string);
    if (!deleted) {
      res.status(404).json({ ok: false, error: 'Idea not found' } satisfies ApiResponse);
      return;
    }
    res.json({ ok: true } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message } satisfies ApiResponse);
  }
});
