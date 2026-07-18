// ============================================================================
// Chat — realtime messaging per project via Supabase Realtime (Postgres
// Changes for persisted messages + Broadcast for typing indicators).
// ============================================================================
import { supabase } from './supabase.js';

export async function getMessages(projectId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, users!messages_sender_fkey(fullname, avatar, role)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendMessage(projectId, receiverId, message) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('messages').insert({
    project_id: projectId,
    sender: user.id,
    receiver: receiverId,
    message,
  });
  if (error) throw error;
}

export async function markMessagesRead(projectId, myUserId) {
  const { error } = await supabase.from('messages')
    .update({ read: true })
    .eq('project_id', projectId)
    .eq('receiver', myUserId)
    .eq('read', false);
  if (error) console.error(error);
}

// Subscribes to new messages + typing broadcasts for a project's chat room.
// Returns the channel so the caller can unsubscribe on page teardown.
export function subscribeToChat(projectId, { onMessage, onTyping }) {
  const channel = supabase
    .channel(`chat:${projectId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
      (payload) => onMessage?.(payload.new)
    )
    .on('broadcast', { event: 'typing' }, (payload) => onTyping?.(payload.payload))
    .subscribe();
  return channel;
}

export function broadcastTyping(channel, userName) {
  channel.send({ type: 'broadcast', event: 'typing', payload: { userName, ts: Date.now() } });
}

export function unsubscribeChat(channel) {
  if (channel) supabase.removeChannel(channel);
}
