'use client';

import { useState } from 'react';
import { ChatMessages } from '../components/ChatMessages';
import { Message } from '../components/ChatMessages/interface';
import { nanoid } from 'nanoid';

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageImgUrl, setMessageImgUrl] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: nanoid(),
      role: 'user',
      content: input
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messages.concat(userMessage).map(({ role, content }) => ({
            role,
            content
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      let accumulatedContent = '';
      let references: any[] = [];
      let buffer = '';
      const SSE_PATTERN = /^data: ({.+}|\[DONE\])\n\n/m;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        while (true) {
          const match = SSE_PATTERN.exec(buffer);
          if (!match) break;

          const data = match[1];
          if (data === '[DONE]') {
            buffer = buffer.slice(match[0].length);
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            accumulatedContent += parsed.content;
            if (parsed.references) {
              references = parsed.references;
            }

            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, content: accumulatedContent, ragDocs: references }
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: nanoid(),
                    role: 'assistant',
                    content: accumulatedContent,
                    ragDocs: references
                  }
                ];
              }
            });
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }

          buffer = buffer.slice(match[0].length);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Handle error appropriately
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (messageId: string) => {
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) return;

    const messagesToKeep = messages.slice(0, messageIndex);
    setMessages(messagesToKeep);
    setIsLoading(true);

    await handleSubmit({
      preventDefault: () => {}
    } as React.FormEvent);
  };

  return (
    <ChatMessages
      messages={messages}
      input={input}
      handleInputChange={handleInputChange}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      messageImgUrl={messageImgUrl}
      setMessagesImgUrl={setMessageImgUrl}
      onRetry={handleRetry}
    />
  );
};

export default Home;
