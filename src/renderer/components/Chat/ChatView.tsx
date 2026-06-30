import { useState, type ReactNode } from "react";
import { useMessages } from "../../hooks/useMessages";
import { usePipelineMessages } from "../../hooks/usePipelineMessages";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import { ErrorToast } from "./ErrorToast";
import type { Attachment, PipelineTemplate } from "../../../shared/types";

interface Props {
  conversationId: string | null;
  backend: string;
  model?: string;
  personaId?: string;
  pipelineTemplate?: PipelineTemplate;
  onNewConversation: (id: string) => void;
  bottomBar?: ReactNode;
}

export function ChatView({
  conversationId,
  backend,
  model,
  personaId,
  pipelineTemplate,
  onNewConversation,
  bottomBar,
}: Props) {
  if (pipelineTemplate) {
    return (
      <PipelineChatView
        conversationId={conversationId}
        template={pipelineTemplate}
        onNewConversation={onNewConversation}
        bottomBar={bottomBar}
      />
    );
  }
  return (
    <SingleChatView
      conversationId={conversationId}
      backend={backend}
      model={model}
      personaId={personaId}
      onNewConversation={onNewConversation}
      bottomBar={bottomBar}
    />
  );
}

function SingleChatView({
  conversationId,
  backend,
  model,
  personaId,
  onNewConversation,
  bottomBar,
}: Omit<Props, "pipelineTemplate">) {
  const { messages, streaming, send, abort } = useMessages(conversationId);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSend = async (
    message: string,
    _attachments: Attachment[],
    messageId: string,
  ) => {
    try {
      const newId = await send(message, backend, personaId, messageId, model);
      if (!conversationId && newId) onNewConversation(newId);
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Failed to send message",
      );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm animate-fade-in-up">
          Start a conversation
        </div>
      )}
      {(messages.length > 0 || streaming) && (
        <MessageList
          messages={messages}
          streaming={streaming}
          conversationId={conversationId}
        />
      )}
      {bottomBar}
      {sendError && (
        <div className="px-4 pt-2">
          <ErrorToast
            message={sendError}
            onDismiss={() => setSendError(null)}
          />
        </div>
      )}
      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
      <StreamingAnnouncer
        content={
          streaming ? (messages[messages.length - 1]?.content ?? "") : ""
        }
      />
    </div>
  );
}

function PipelineChatView({
  conversationId,
  template,
  onNewConversation,
  bottomBar,
}: {
  conversationId: string | null;
  template: PipelineTemplate;
  onNewConversation: (id: string) => void;
  bottomBar?: ReactNode;
}) {
  const {
    stepMessages,
    streamingStepIndex,
    activeTabIndex,
    setActiveTabIndex,
    send,
    abort,
  } = usePipelineMessages(conversationId, template);
  const streaming = streamingStepIndex !== null;

  const handleSend = async (
    message: string,
    _attachments: Attachment[],
    _messageId: string,
  ) => {
    const newId = await send(message);
    if (!conversationId && newId) onNewConversation(newId);
  };

  const activeMessages = stepMessages[activeTabIndex] ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Step tabs */}
      <div
        role="tablist"
        aria-label="Pipeline steps"
        className="flex border-b border-border overflow-x-auto"
      >
        {template.steps.map((step, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={activeTabIndex === i}
            aria-controls={`step-panel-${i}`}
            id={`step-tab-${i}`}
            onClick={() => !streaming && setActiveTabIndex(i)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors transition-transform duration-100 ease-press active:scale-95 ${
              activeTabIndex === i
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hoverable:hover:text-text-base"
            } ${streaming && streamingStepIndex !== i ? "opacity-50" : ""}`}
          >
            {step.backendId}
            {streamingStepIndex === i && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Messages for active tab */}
      {activeMessages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm animate-fade-in-up">
          {Object.keys(stepMessages).length === 0
            ? "Start a pipeline run"
            : "No output for this step yet"}
        </div>
      )}
      {activeMessages.length > 0 && (
        <MessageList
          id={`step-panel-${activeTabIndex}`}
          aria-labelledby={`step-tab-${activeTabIndex}`}
          role="tabpanel"
          messages={activeMessages}
          streaming={streaming && streamingStepIndex === activeTabIndex}
          conversationId={conversationId}
        />
      )}

      {bottomBar}
      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
      <StreamingAnnouncer
        content={
          streaming && streamingStepIndex === activeTabIndex
            ? (activeMessages[activeMessages.length - 1]?.content ?? "")
            : ""
        }
      />
    </div>
  );
}

function StreamingAnnouncer({ content }: { content: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="sr-only"
    >
      {content}
    </div>
  );
}
