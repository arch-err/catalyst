import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Hammer, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useIdea } from '@/hooks/useIdeas';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useConnectionStore } from '@/stores/connection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { WsServerMessage, IdeaStatus } from '@catalyst/shared';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ToolActivity {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  collapsed: boolean;
}

export function SessionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { idea, loading, refetch } = useIdea(slug ?? '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tools, setTools] = useState<ToolActivity[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const onMessage = useCallback(
    (msg: WsServerMessage) => {
      if ('ideaId' in msg && msg.ideaId !== idea?.id && msg.ideaId !== idea?.slug) return;

      switch (msg.type) {
        case 'claude:system':
          setStreaming(true);
          setStreamBuffer('');
          break;
        case 'claude:text':
          setStreamBuffer((prev) => prev + msg.text);
          scrollToBottom();
          break;
        case 'claude:tool_use':
          setTools((prev) => [
            ...prev,
            { id: msg.toolUseId, name: msg.name, input: msg.input, collapsed: true },
          ]);
          break;
        case 'claude:tool_result':
          setTools((prev) =>
            prev.map((t) => (t.id === msg.toolUseId ? { ...t, result: msg.content } : t)),
          );
          break;
        case 'claude:result': {
          const finalText = streamBuffer || msg.result || '';
          if (finalText) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: finalText, timestamp: Date.now() },
            ]);
          }
          setStreamBuffer('');
          setStreaming(false);
          refetch();
          scrollToBottom();
          break;
        }
        case 'claude:error':
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `Error: ${msg.error}`, timestamp: Date.now() },
          ]);
          setStreaming(false);
          break;
      }
    },
    [idea?.id, idea?.slug, scrollToBottom, refetch, streamBuffer],
  );

  const { send, status } = useWebSocket({ onMessage });
  const setConnectionStatus = useConnectionStore((s) => s.setStatus);

  useEffect(() => {
    setConnectionStatus(status);
  }, [status, setConnectionStatus]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamBuffer, scrollToBottom]);

  const sendChat = () => {
    if (!input.trim() || !idea || streaming) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: input.trim(), timestamp: Date.now() },
    ]);
    send({ type: 'chat', ideaId: idea.slug, message: input.trim() });
    setInput('');
    inputRef.current?.focus();
  };

  const sendBuild = () => {
    if (!idea || streaming) return;
    const instructions =
      input.trim() ||
      'Build this project based on our discussion. Create all necessary files in the project directory.';
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `[BUILD] ${instructions}`, timestamp: Date.now() },
    ]);
    send({ type: 'build', ideaId: idea.slug, instructions });
    setInput('');
  };

  const handleCancel = () => {
    if (!idea) return;
    send({ type: 'cancel', ideaId: idea.slug });
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, collapsed: !t.collapsed } : t)),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Idea not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen md:h-screen">
      {/* Header */}
      <div className="border-b border-border p-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{idea.title}</h1>
        </div>
        <Badge variant={idea.status as IdeaStatus}>{idea.status}</Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Show idea content as first message context */}
        {idea.content && (
          <div className="bg-card border border-border rounded-lg p-4 text-sm">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Original Idea</p>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{idea.content}</ReactMarkdown>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const inline = !match;
                        return inline ? (
                          <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                            {children}
                          </code>
                        ) : (
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.8rem' }}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming text */}
        {streamBuffer && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-2 bg-card border border-border">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamBuffer}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Tool activity */}
        {tools.length > 0 && (
          <div className="space-y-1">
            {tools.map((tool) => (
              <div key={tool.id} className="border border-border rounded bg-card text-xs">
                <button
                  onClick={() => toggleTool(tool.id)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-accent/50 transition-colors"
                >
                  {tool.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span className="font-mono text-muted-foreground">{tool.name}</span>
                  {tool.result && (
                    <span className="text-green-400 ml-auto">done</span>
                  )}
                </button>
                {!tool.collapsed && (
                  <div className="p-2 border-t border-border space-y-2">
                    <pre className="text-muted-foreground overflow-x-auto">
                      {JSON.stringify(tool.input, null, 2)}
                    </pre>
                    {tool.result && (
                      <pre className="text-green-400/80 overflow-x-auto max-h-40 overflow-y-auto">
                        {tool.result.slice(0, 2000)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Streaming indicator */}
        {streaming && !streamBuffer && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            Claude is thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border p-3 flex gap-2 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <Input
          ref={inputRef}
          placeholder={streaming ? 'Claude is working...' : 'Send a message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          className="flex-1"
        />
        {streaming ? (
          <Button variant="destructive" size="icon" onClick={handleCancel}>
            <XCircle size={18} />
          </Button>
        ) : (
          <>
            <Button size="icon" onClick={sendChat} disabled={!input.trim()}>
              <Send size={18} />
            </Button>
            {(idea.status === 'chatting' || idea.status === 'captured') && (
              <Button
                variant="secondary"
                size="icon"
                onClick={sendBuild}
                title="Build project"
              >
                <Hammer size={18} />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
