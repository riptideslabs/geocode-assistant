"use client";

import {
  AssistantRuntimeProvider,
  makeAssistantToolUI,
  ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ToolCallingArgs = {
  coordinates?: string;
  address?: string;
};
type ToolCallingResult = {
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  token?: string;
  state?: "started" | "completed" | "error";
};

const formatToken = (token: string) => {
  if (token.length <= 8) return token;
  return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
};

const geocodeRenderer: ToolCallMessagePartComponent<ToolCallingArgs, ToolCallingResult> = ({
  args,
  toolName,
  result,
  isError,
}) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [isCollapsed, setIsCollapsed] = useState(true);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [token, setToken] = useState<string | undefined>(undefined);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (result && result.state === "started" && result.token) {
        setToken(result.token);
      }
    }, [result]);

    return (
      <div className="aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3">
        <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
          {isError ? (
            <>
              <div className="flex-grow">
                <div className="text-sm text-red-500">
                  <b>Error occurred</b>
                </div>
              </div>
              <Button onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </Button>
            </>
          ) : (
            <>
              <CheckIcon className="aui-tool-fallback-icon size-4" />
              <div className="flex-grow">
                <div className="aui-tool-fallback-title">
                  <b>Tool called:</b> {toolName}
                </div>
                {token && (
                  <div className="text-sm text-muted-foreground">
                    with access token: {formatToken("none")}
                  </div>
                )}
              </div>
              <Button onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </Button>
            </>
          )}
        </div>
        {!isCollapsed && (
          <div className="aui-tool-fallback-content flex flex-col gap-2 border-t pt-2">
            <div className="aui-tool-fallback-args-root px-4">
              <pre className="aui-tool-fallback-args-value whitespace-pre-wrap">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
            {result !== undefined && (
              <div className="aui-tool-fallback-result-root border-t border-dashed px-4 pt-2">
                <p className="aui-tool-fallback-result-header font-semibold">
                  Result:
                </p>
                <pre className="aui-tool-fallback-result-content whitespace-pre-wrap">
                  {typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2) ||
                      (isError ? "error" : "unknown")}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

const AddrToCoordsToolUI = makeAssistantToolUI<ToolCallingArgs, ToolCallingResult>({
  toolName: "addressToCoord",
  render: geocodeRenderer
});

const CoordToAddrToolUI = makeAssistantToolUI<ToolCallingArgs, ToolCallingResult>({
  toolName: "coordToAddress",
  render: geocodeRenderer
});

export const Assistant = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AddrToCoordsToolUI />
      <CoordToAddrToolUI />
      <div className="flex h-dvh w-full pr-0.5">
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
};
