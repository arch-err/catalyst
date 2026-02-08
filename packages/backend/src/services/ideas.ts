import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { sshService } from './ssh.js';
import { config } from '../config.js';
import type { IdeaMeta, Idea, IdeaStatus } from '@catalyst/shared';

const basePath = config.ideasBasePath;

function ideaDir(slug: string): string {
  return `${basePath}/${slug}`;
}

function escapeShell(s: string): string {
  // Use $'...' quoting for safe shell escaping
  return "$'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
}

export class IdeasService {
  async list(): Promise<IdeaMeta[]> {
    try {
      const result = await sshService.exec(
        `find ${basePath} -maxdepth 2 -name meta.json -exec cat {} \\;`,
      );
      if (!result.trim()) return [];
      // Each meta.json is a single JSON object, separated by newlines
      const metas: IdeaMeta[] = [];
      for (const line of result.trim().split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{')) {
          try {
            metas.push(JSON.parse(trimmed));
          } catch {
            // skip malformed
          }
        }
      }
      // Sort by updatedAt descending
      metas.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return metas;
    } catch {
      // Directory might not exist yet
      return [];
    }
  }

  async get(idOrSlug: string): Promise<Idea | null> {
    try {
      // Try by slug first
      const metaStr = await sshService.exec(`cat ${ideaDir(idOrSlug)}/meta.json 2>/dev/null`);
      const meta: IdeaMeta = JSON.parse(metaStr.trim());
      let content: string | undefined;
      try {
        content = await sshService.exec(`cat ${ideaDir(idOrSlug)}/idea.md 2>/dev/null`);
      } catch {
        // idea.md might not exist
      }
      return { ...meta, content: content?.trim() };
    } catch {
      // Try finding by ID
      try {
        const result = await sshService.exec(
          `grep -rl '"id":"${idOrSlug}"' ${basePath}/*/meta.json 2>/dev/null | head -1`,
        );
        if (!result.trim()) return null;
        const dir = result.trim().replace('/meta.json', '');
        const metaStr = await sshService.exec(`cat ${dir}/meta.json`);
        const meta: IdeaMeta = JSON.parse(metaStr.trim());
        let content: string | undefined;
        try {
          content = await sshService.exec(`cat ${dir}/idea.md 2>/dev/null`);
        } catch {
          // skip
        }
        return { ...meta, content: content?.trim() };
      } catch {
        return null;
      }
    }
  }

  async create(title: string, content: string): Promise<IdeaMeta> {
    const id = uuidv4();
    const slug = slugify(title, { lower: true, strict: true });
    const now = new Date().toISOString();
    const meta: IdeaMeta = {
      id,
      slug,
      title,
      status: 'captured',
      createdAt: now,
      updatedAt: now,
    };

    const dir = ideaDir(slug);
    const metaJson = JSON.stringify(meta);
    const escapedContent = escapeShell(content);
    const escapedMeta = escapeShell(metaJson);

    await sshService.exec(
      `mkdir -p ${dir} && echo ${escapedMeta} > ${dir}/meta.json && echo ${escapedContent} > ${dir}/idea.md`,
    );

    return meta;
  }

  async update(idOrSlug: string, updates: Partial<Pick<IdeaMeta, 'title' | 'status' | 'sessionId'>>): Promise<IdeaMeta | null> {
    const idea = await this.get(idOrSlug);
    if (!idea) return null;

    const updated: IdeaMeta = {
      id: idea.id,
      slug: idea.slug,
      title: updates.title ?? idea.title,
      status: updates.status ?? idea.status,
      sessionId: updates.sessionId ?? idea.sessionId,
      createdAt: idea.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const dir = ideaDir(idea.slug);
    const escapedMeta = escapeShell(JSON.stringify(updated));
    await sshService.exec(`echo ${escapedMeta} > ${dir}/meta.json`);

    return updated;
  }

  async delete(idOrSlug: string): Promise<boolean> {
    const idea = await this.get(idOrSlug);
    if (!idea) return false;
    await sshService.exec(`rm -rf ${ideaDir(idea.slug)}`);
    return true;
  }

  async ensureBasePath(): Promise<void> {
    await sshService.exec(`mkdir -p ${basePath}`);
  }
}

export const ideasService = new IdeasService();
