'use client';

import { useChat } from '@ai-sdk/react';
import { ChatMessages } from '../components/ChatMessages';
import { Message } from '../components/ChatMessages/interface';
import { RAGDocument } from '../components/RAGDocsShow/interface';

const Home = () => {
  const {
    messages: aiMessages,
    input,
    isLoading,
    handleInputChange,
    handleSubmit,
    reload
  } = useChat({
    api: '/api/vercelai',
    onError: (error) => {
      console.error('聊天错误:', error);
    },
    onFinish: (message) => {
      console.log('对话完成:', message);
    }
  });

  // 转换消息格式以匹配组件期望的类型
  const messages: Message[] = aiMessages
    .filter((msg) => msg.role !== 'data') // 过滤掉 data 类型的消息
    .map((msg) => {
      console.log('msg', msg);
      // 只有assistant消息才需要ragDocs
      let ragDocs: RAGDocument[] | undefined;
      const annotation = msg.annotations;
      if (Array.isArray(annotation) && annotation.length > 0) {
        ragDocs = (annotation[0] as any).ragDocs as RAGDocument[];
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'tool',
        content: msg.content,
        ragDocs: ragDocs
      };
    });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(e);
  };

  const onRetry = () => {
    reload();
  };

  return (
    <ChatMessages
      messages={messages}
      input={input}
      handleInputChange={handleInputChange}
      onSubmit={onSubmit}
      isLoading={isLoading}
      messageImgUrl={''}
      setMessagesImgUrl={() => {}}
      onRetry={onRetry}
      ref={null}
    />
  );
};

export default Home;
