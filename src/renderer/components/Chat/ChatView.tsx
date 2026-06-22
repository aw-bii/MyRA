import { useMessages } from "../../hooks/useMessages";
import { usePipelineMessages } from "../../hooks/usePipelineMessages";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import type { Attachment, PipelineTemplate } from "../../../shared/types";

interface Props {
  conversationId: string | null;
  backend: string;
  personaId?: string;
  pipelineTemplate?: PipelineTemplate;
  onNewConversation: (id: string) => void;
}

export function ChatView({
  conversationId,
  backend,
  personaId,
  pipelineTemplate,
  onNewConversation,
}: Props) {
  if (pipelineTemplate) {
    return (
      <PipelineChatView
        conversationId={conversationId}
        template={pipelineTemplate}
        onNewConversation={onNewConversation}
      />
    );
  }
  return (
    <SingleChatView
      conversationId={conversationId}
      backend={backend}
      personaId={personaId}
      onNewConversation={onNewConversation}
    />
  );
}

function SingleChatView({
  conversationId,
  backend,
  personaId,
  onNewConversation,
}: Omit<Props, "pipelineTemplate">) {
  const { messages, streaming, send, abort } = useMessages(conversationId);

  const handleSend = async (
    message: string,
    _attachments: Attachment[],
    messageId: string,
  ) => {
    const newId = await send(message, backend, personaId, messageId);
    if (!conversationId && newId) onNewConversation(newId);
  };

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-fade-in-up">
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
      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
    </div>
  );
}

function PipelineChatView({
  conversationId,
  template,
  onNewConversation,
}: {
  conversationId: string | null;
  template: PipelineTemplate;
  onNewConversation: (id: string) => void;
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
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {template.steps.map((step, i) => (
          <button
            key={i}
            onClick={() => !streaming && setActiveTabIndex(i)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors transition-transform duration-100 ease-press active:scale-95 ${
              activeTabIndex === i
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hoverable:hover:text-gray-700 dark:hoverable:hover:text-gray-300"
            } ${streaming && streamingStepIndex !== i ? "opacity-50" : ""}`}
          >
            {step.backendId}
            {streamingStepIndex === i && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Messages for active tab */}
      {activeMessages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-fade-in-up">
          {Object.keys(stepMessages).length === 0
            ? "Start a pipeline run"
            : "No output for this step yet"}
        </div>
      )}
      {activeMessages.length > 0 && (
        <MessageList
          messages={activeMessages}
          streaming={streaming && streamingStepIndex === activeTabIndex}
          conversationId={conversationId}
        />
      )}

      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
    </div>
  );
}
