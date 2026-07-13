/**
 * MCP协议实现 + Agent双向桥
 * P1-3: AgentAction ↔ MCPTool 双向映射
 */

import type { AgentAction } from '../types';

// ===== MCP 标准类型 =====
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: 'text' | 'image' | 'resource'; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  tools: MCPTool[];
  endpoint?: string;
  transport: 'stdio' | 'sse' | 'http';
}

// ===== MCP 注册表 =====
export class MCPServerRegistry {
  private servers = new Map<string, MCPServerInfo>();
  private tools = new Map<string, { tool: MCPTool; serverId: string }>();

  /** 从AgentAction列表注册为MCP工具 */
  registerLocalTools(actions: AgentAction[]): void {
    const serverId = 'local-agent';
    const tools: MCPTool[] = actions.map(a => ({
      name: a.name,
      description: a.description,
      inputSchema: { type: 'object', properties: {}, required: [] },
    }));

    this.servers.set(serverId, {
      name: 'Local Agent Tools',
      version: '1.0.0',
      tools,
      transport: 'http',
    });

    for (const tool of tools) {
      this.tools.set(tool.name, { tool, serverId });
    }

    console.log(`[MCP] Registered ${tools.length} local agent tools`);
  }

  /** 连接远程MCP Server */
  async connectRemote(config: { id: string; endpoint: string; transport?: 'sse' | 'http' }): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${config.endpoint}/tools/list`, { signal: ctrl.signal });
      if (!res.ok) return false;
      const data = await res.json();
      const tools: MCPTool[] = data.tools || [];

      this.servers.set(config.id, {
        name: config.id,
        version: 'remote',
        tools,
        endpoint: config.endpoint,
        transport: config.transport || 'http',
      });

      for (const tool of tools) {
        this.tools.set(tool.name, { tool, serverId: config.id });
      }

      console.log(`[MCP] Connected to ${config.id}: ${tools.length} tools`);
      return true;
    } catch {
      console.warn(`[MCP] Failed to connect to ${config.id}`);
      return false;
    }
  }

  /** 断开远程MCP Server */
  disconnect(id: string): void {
    this.servers.delete(id);
    for (const [name, entry] of this.tools) {
      if (entry.serverId === id) this.tools.delete(name);
    }
  }

  /** 列出所有工具 */
  listTools(): MCPTool[] {
    return Array.from(this.tools.values()).map(e => e.tool);
  }

  /** 通过名称获取工具 */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name)?.tool;
  }

  /** 调用远程MCP工具 */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return { content: [{ type: 'text', text: `Tool "${toolName}" not found` }], isError: true };
    }

    const server = this.servers.get(entry.serverId);
    if (!server?.endpoint) {
      return { content: [{ type: 'text', text: `Server not connected: ${entry.serverId}` }], isError: true };
    }

    try {
      const res = await fetch(`${server.endpoint}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, arguments: args }),
      });
      const data = await res.json();
      return {
        content: data.content || [{ type: 'text', text: JSON.stringify(data) }],
        isError: !res.ok,
      };
    } catch (e: any) {
      return { content: [{ type: 'text', text: `MCP call failed: ${e.message}` }], isError: true };
    }
  }

  /** 获取所有已连接服务器 */
  listServers(): MCPServerInfo[] {
    return Array.from(this.servers.values());
  }

  /** 健康检查 */
  async healthCheck(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server?.endpoint) return false;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`${server.endpoint}/health`, { signal: ctrl.signal });
      return res.ok;
    } catch { return false; }
  }
}

// 全局单例
export const mcpRegistry = new MCPServerRegistry();

/**
 * 双向桥：AgentAction → MCPTool 导出
 * 将 Agent 的工具自动暴露为 MCP 标准协议
 */
export function exportAgentAsMCP(actions: AgentAction[]): MCPTool[] {
  return actions.map(a => ({
    name: a.name,
    description: a.description,
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  }));
}

/**
 * 双向桥：MCPTool → 导入为 AgentAction
 * 将远程 MCP 工具注册为 Agent 可用工具
 */
export function importMCPAsAgent(tool: MCPTool): AgentAction {
  return {
    name: tool.name,
    description: tool.description,
    category: 'query',
    handler: async (params) => {
      const result = await mcpRegistry.callTool(tool.name, params);
      if (result.isError) {
        return { success: false, error: result.content[0]?.text || 'MCP error' };
      }
      return { success: true, data: result.content[0]?.text };
    },
  };
}
