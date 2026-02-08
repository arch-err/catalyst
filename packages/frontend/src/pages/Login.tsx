import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginPage() {
  const [secret, setSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login, error, authenticated } = useAuthStore();

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true });
  }, [authenticated, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    setSubmitting(true);
    const ok = await login(secret);
    setSubmitting(false);
    if (ok) navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Catalyst</h1>
          <p className="text-muted-foreground text-sm">Enter your secret to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={inputRef}
            type="password"
            placeholder="Secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || !secret.trim()}>
            {submitting ? 'Authenticating...' : 'Enter'}
          </Button>
        </form>
      </div>
    </div>
  );
}
