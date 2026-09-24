import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useContent } from '../lib/content';
import { useIdle } from '../lib/hooks';

const ChatWidgetInner = dynamic(() => import('./ChatWidgetInner'), { ssr: false });

// react-chat-widget is sizeable, so it loads when the browser is idle — or immediately when a
// visitor asks for it (placeholder launcher or the FAQ "ask in chat" button).
export default function ChatWidget() {
  const { widgets } = useContent();
  const idle = useIdle(2500);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const onOpen = () => setRequested(true);
    window.addEventListener('open-chat', onOpen);
    return () => window.removeEventListener('open-chat', onOpen);
  }, []);

  if (idle || requested) return <ChatWidgetInner openOnMount={requested} />;
  return (
    <div className="rcw-widget-container rcw-placeholder">
      <button type="button" className="rcw-launcher link" aria-label={widgets.chatTitle} onClick={() => setRequested(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3.5 21l1.4-4.6A8.5 8.5 0 1 1 21 12Z" />
        </svg>
      </button>
    </div>
  );
}
