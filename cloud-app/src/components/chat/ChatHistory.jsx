import { useState, useEffect } from 'react';
import { MessageSquare, ChevronRight, Clock, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ChatHistory({ domainId, onLoadSession, currentSessionId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageCounts, setMessageCounts] = useState({});
  const [firstMessages, setFirstMessages] = useState({});

  useEffect(() => {
    if (domainId) fetchSessions();
  }, [domainId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ChatSession.filter({ domain_id: domainId }, '-created_date', 5);
      setSessions(data);

      for (const s of data) {
        try {
          const msgs = await base44.entities.ChatMessage.filter({ session_id: s.id }, 'created_date', 200);
          setMessageCounts(prev => ({ ...prev, [s.id]: msgs.length }));
          const firstUserMsg = msgs.find(m => m.role === 'user');
          setFirstMessages(prev => ({ ...prev, [s.id]: firstUserMsg?.content || s.title || 'Conversation' }));
        } catch (e) {
          console.error('Failed to load messages for session', s.id, e);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <MessageSquare className="w-4 h-4 animate-pulse" />
        Loading chat history...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
          <MessageSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No chat history yet</p>
        <p className="text-xs text-muted-foreground">Start a conversation and it will appear here for future reference.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Recent Conversations
        </h3>
        <span className="text-[11px] text-muted-foreground">Last {sessions.length} sessions</span>
      </div>

      <div className="space-y-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onLoadSession(s.id)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${currentSessionId === s.id ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {firstMessages[s.id] || s.title || 'Conversation'}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">
                    {messageCounts[s.id] || 0} messages
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(s.created_date).toLocaleDateString()} at {new Date(s.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}