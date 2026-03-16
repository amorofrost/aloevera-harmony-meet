import { useEffect, useCallback } from 'react';
import { chatConnection } from '@/services/signalr/chatConnection';

type GroupType = 'chat' | 'topic';

interface UseChatSignalRReturn {
  sendMessage: (chatId: string, content: string) => Promise<void>;
  isConnected: boolean;
  onEvent: (event: string, handler: (...args: unknown[]) => void) => () => void;
}

export function useChatSignalR(type: GroupType, id: string): UseChatSignalRReturn {
  const groupId = `${type}-${id}`;

  useEffect(() => {
    if (!id) return;

    let mounted = true;

    const setup = async () => {
      await chatConnection.connect();
      if (!mounted) return;
      if (type === 'chat') await chatConnection.joinChat(id);
      if (type === 'topic') await chatConnection.joinTopic(id);
    };

    setup();

    return () => {
      mounted = false;
      chatConnection.leaveGroup(groupId);
    };
  }, [type, id, groupId]); // re-runs when id changes (e.g. navigating between chats)

  // onEvent registers a handler and returns its cleanup function.
  // Usage: const off = onEvent('MessageReceived', handler); return off;
  // The caller's useEffect return value should be the returned cleanup fn.
  const onEvent = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      chatConnection.on(event, handler);
      return () => chatConnection.off(event, handler);
    },
    []
  );

  const sendMessage = useCallback(
    (chatId: string, content: string) => chatConnection.sendMessage(chatId, content),
    []
  );

  return {
    sendMessage,
    isConnected: chatConnection.isConnected,
    onEvent,
  };
}
