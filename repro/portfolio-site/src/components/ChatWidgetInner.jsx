import { useCallback, useEffect } from 'react';
import { Widget, addResponseMessage, addUserMessage, isWidgetOpened, setQuickButtons, toggleMsgLoader, toggleWidget } from 'react-chat-widget';
import 'react-chat-widget/lib/styles.css';
import { track } from '../lib/analytics';
import { useContent } from '../lib/content';

const AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#FF4D2E"/><text x="31" y="43" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="34" fill="#fff">M</text><circle cx="46" cy="41" r="2.6" fill="#141414"/></svg>',
  );

let greeted = false;

// Live chat powered by react-chat-widget with a small scripted assistant (no backend in this demo).
export default function ChatWidgetInner({ openOnMount }) {
  const { chat, widgets } = useContent();

  const reply = useCallback(
    (key) => {
      toggleMsgLoader();
      window.setTimeout(() => {
        toggleMsgLoader();
        addResponseMessage(chat.answers[key] || chat.answers.fallback);
      }, 700 + Math.round(Math.random() * 600));
    },
    [chat.answers],
  );

  useEffect(() => {
    if (!greeted) {
      greeted = true;
      addResponseMessage(chat.welcome);
      setQuickButtons(chat.quick.map(([label, value]) => ({ label, value })));
    }
    if (openOnMount && !isWidgetOpened()) toggleWidget();
    const onOpen = () => !isWidgetOpened() && toggleWidget();
    window.addEventListener('open-chat', onOpen);
    return () => window.removeEventListener('open-chat', onOpen);
  }, [chat, openOnMount]);

  // The library always points aria-controls at the conversation panel, which only exists while the
  // chat is open; keep the attribute (and aria-expanded) in sync so it never references nothing.
  useEffect(() => {
    const root = document.querySelector('.rcw-widget-container');
    if (!root) return undefined;
    const sync = () => {
      const launcher = root.querySelector('.rcw-launcher');
      if (!launcher) return;
      const open = Boolean(document.getElementById('rcw-chat-container'));
      if (open && launcher.getAttribute('aria-controls') !== 'rcw-chat-container') launcher.setAttribute('aria-controls', 'rcw-chat-container');
      if (!open && launcher.hasAttribute('aria-controls')) launcher.removeAttribute('aria-controls');
      if (launcher.getAttribute('aria-expanded') !== String(open)) launcher.setAttribute('aria-expanded', String(open));
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-controls', 'class'] });
    return () => mo.disconnect();
  }, []);

  const handleNewUserMessage = (message) => {
    const text = message.toLowerCase();
    const match = Object.entries(chat.keywords).find(([, words]) => words.some((w) => text.includes(w)));
    track('chat_message', { intent: match ? match[0] : 'fallback' });
    reply(match ? match[0] : 'fallback');
  };

  const handleQuickButtonClicked = (value) => {
    const label = chat.quick.find(([, v]) => v === value)?.[0] || value;
    addUserMessage(label);
    track('chat_quick_reply', { intent: value });
    reply(value);
  };

  return (
    <Widget
      handleNewUserMessage={handleNewUserMessage}
      handleQuickButtonClicked={handleQuickButtonClicked}
      title={widgets.chatTitle}
      subtitle={widgets.chatSubtitle}
      senderPlaceHolder={widgets.chatPlaceholder}
      profileAvatar={AVATAR}
      titleAvatar={AVATAR}
      showTimeStamp
      emojis={false}
      autofocus
      showBadge
      launcherOpenLabel={widgets.chatTitle}
      launcherCloseLabel={widgets.chatTitle}
      sendButtonAlt="Send"
    />
  );
}
