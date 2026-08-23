# 05. Frontend Engineering & React Lifecycle

This document explains the frontend architecture, state management, optimistic UI updates, and Next.js 14+ / React 19 patterns implemented in [page.tsx](file:///home/abhishekg/Projects/chat%20application%20trial/frontend/src/app/page.tsx).

---

## 1. Component Architecture & UI Breakdown

The frontend is structured into a responsive two-column layout using **Tailwind CSS** and **shadcn/ui**:

```mermaid
flowchart TB
    subgraph ChatPage["ChatPage (frontend/src/app/page.tsx)"]
        subgraph Col1["Column 1: Sidebar (Contacts & Channels)"]
            Header1["Header + 'New Group' Dialog + Search Bar"]
            ConvList["Active Conversations (Group + Direct)"]
            ContactsList["All Registered Contacts"]
            Footer1["User Identity + Logout Button"]
        end

        subgraph Col2["Column 2: Active Chat Stage"]
            Header2["Conversation Title + Online Badge + WSS Live Badge"]
            Feed["ScrollArea: Message Bubbles + Typing Indicator"]
            Anchor["messagesEndRef Auto-Scroll Anchor"]
            InputBar["Message Input + Send Button"]
        end
    end
```

---

## 2. Optimistic UI Updates Explained

In real-time messaging, waiting for the server and database to acknowledge a message before displaying it creates perceived lag (100–300ms).

The app implements **Optimistic UI Rendering**:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant State as React State (messages)
    participant Socket as Socket.IO Client
    participant Server as Bun Backend (Socket.IO + DB)

    User->>State: Types message and clicks "Send"
    State->>State: Immediately append message with tempId & status: 'sending'
    Note over State: Message renders instantly on screen with spinning icon
    State->>Socket: emit('send_message', { text, conversationId, tempId })
    Socket->>Server: Process & Save to MongoDB
    Server-->>Socket: emit('receive_message', { message, tempId })
    Socket->>State: Find message matching tempId -> Replace with savedDoc (status: 'sent')
    Note over State: Spinning icon flips to blue double-check (✓✓)
```

### Implementation in Code:
```typescript
// 1. Instantly create temporary optimistic message
const tempId = `temp_${Date.now()}_${Math.random()}`;
const optimisticMsg: Message = {
  _id: tempId,
  tempId,
  conversationId: activeConversation._id,
  sender: currentUserId,
  senderName: currentUsername,
  text: textToSend,
  status: 'sending',
  createdAt: new Date().toISOString()
};

setMessages((prev) => [...prev, optimisticMsg]);

// 2. Reconcile upon backend confirmation
socketClient.on('receive_message', ({ message, tempId }) => {
  setMessages((prev) => {
    if (tempId && prev.some((m) => m.tempId === tempId)) {
      return prev.map((m) => (m.tempId === tempId ? message : m));
    }
    return [...prev, message];
  });
});
```

---

## 3. Auto-Scrolling Mechanism with `useRef`

When reading or sending messages, the view should automatically scroll to the newest message at the bottom.

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

// Triggers whenever messages array changes
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

In JSX, an empty `<div>` anchor is placed at the end of the scroll list:
```tsx
<div className="flex flex-col gap-4">
  {messages.map((msg) => (
    <MessageBubble key={msg._id} message={msg} />
  ))}
  <div ref={messagesEndRef} />
</div>
```

---

## 4. Live Network Resilience (Graceful Degradation)

The UI dynamically reacts to connection drops:

```typescript
socketClient.on('connect', () => setIsConnected(true));
socketClient.on('disconnect', () => setIsConnected(false));
```

* **When Connected**: The header shows a green `WSS LIVE` badge, and input controls are active.
* **When Disconnected**: The header pulses a red `RECONNECTING...` badge, and the `<Input>` and `<Button>` are physically disabled (`disabled={!isConnected}`) to prevent messages from being lost during outages.
