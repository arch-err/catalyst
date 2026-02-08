import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useIdeas } from '@/hooks/useIdeas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { IdeaStatus } from '@catalyst/shared';

export function DashboardPage() {
  const { ideas, loading, fetchIdeas, deleteIdea } = useIdeas();
  const navigate = useNavigate();

  const handleDelete = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    if (confirm('Delete this idea?')) {
      await deleteIdea(slug);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ideas</h1>
        <Button variant="ghost" size="icon" onClick={() => fetchIdeas()} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {ideas.length === 0 && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No ideas yet</p>
          <p className="text-sm mt-1">Capture your first idea to get started</p>
        </div>
      )}

      <div className="space-y-2">
        {ideas.map((idea) => (
          <button
            key={idea.id}
            onClick={() => navigate(`/idea/${idea.slug}`)}
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors flex items-center justify-between group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{idea.title}</span>
                <Badge variant={idea.status as IdeaStatus}>{idea.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(idea.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <button
              onClick={(e) => handleDelete(e, idea.slug)}
              className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all"
            >
              <Trash2 size={16} />
            </button>
          </button>
        ))}
      </div>

      {/* FAB for mobile */}
      <button
        onClick={() => navigate('/capture')}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:bg-primary/90 transition-colors"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
