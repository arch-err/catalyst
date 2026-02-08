import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIdeas } from '@/hooks/useIdeas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function CapturePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { createIdea } = useIdeas();

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    const idea = await createIdea(title.trim(), content.trim());
    setSaving(false);
    if (idea) {
      navigate(`/idea/${idea.slug}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Capture Idea</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          ref={titleRef}
          placeholder="What's the idea?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg h-12"
        />
        <Textarea
          placeholder="Describe it... What problem does it solve? Who's it for? Key features?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[200px] text-base"
          rows={8}
        />
        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={saving || !title.trim() || !content.trim()}
        >
          {saving ? 'Saving...' : 'Save & Start Refining'}
        </Button>
      </form>
    </div>
  );
}
