import { useState, useCallback, useEffect } from 'react';
import type { IdeaMeta, Idea, ApiResponse } from '@catalyst/shared';

export function useIdeas() {
  const [ideas, setIdeas] = useState<IdeaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ideas');
      const data: ApiResponse<IdeaMeta[]> = await res.json();
      if (data.ok && data.data) {
        setIdeas(data.data);
      } else {
        setError(data.error ?? 'Failed to fetch ideas');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createIdea = useCallback(async (title: string, content: string): Promise<IdeaMeta | null> => {
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data: ApiResponse<IdeaMeta> = await res.json();
      if (data.ok && data.data) {
        setIdeas((prev) => [data.data!, ...prev]);
        return data.data;
      }
      setError(data.error ?? 'Failed to create idea');
      return null;
    } catch {
      setError('Network error');
      return null;
    }
  }, []);

  const deleteIdea = useCallback(async (idOrSlug: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ideas/${idOrSlug}`, { method: 'DELETE' });
      const data: ApiResponse = await res.json();
      if (data.ok) {
        setIdeas((prev) => prev.filter((i) => i.slug !== idOrSlug && i.id !== idOrSlug));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  return { ideas, loading, error, fetchIdeas, createIdea, deleteIdea };
}

export function useIdea(slug: string) {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIdea = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ideas/${slug}`);
      const data: ApiResponse<Idea> = await res.json();
      if (data.ok && data.data) {
        setIdea(data.data);
      }
    } catch {
      // skip
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchIdea();
  }, [fetchIdea]);

  return { idea, loading, refetch: fetchIdea };
}
