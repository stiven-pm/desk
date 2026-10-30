export type ToolParameter = {
  name: string;
  in: "path" | "query" | "body";
  description?: string;
  required?: boolean;
  schema?: Record<string, unknown>;
};

export type BotHttpTool = {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  parameters: ToolParameter[];
  baseUrl: string;
  authType: "none" | "bearer" | "header";
  authHeaderName?: string;
  authSecret?: string;
  extraHeaders?: Record<string, string>;
};

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverUrl: string;
  serverName: string;
  headers: Record<string, string>;
};

export type DeskIntegrationTool = {
  id: string;
  name: string;
  description: string;
  instanceId: string;
  operation: import("@chatbot/domain").IntegrationOperationDef;
  connector: import("@chatbot/domain").ConnectorConfig;
  fieldValues: Record<string, string>;
  requiresConfirm: boolean;
  inputSchema: Record<string, unknown>;
};

export type AgentTool =
  | { kind: "http"; tool: BotHttpTool }
  | { kind: "mcp"; tool: McpToolDef }
  | { kind: "integration"; tool: DeskIntegrationTool };

export type LlmToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
