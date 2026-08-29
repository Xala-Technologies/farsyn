#!/usr/bin/env node
/**
 * Remote MCP over Streamable HTTP (POST/GET/DELETE /mcp).
 *
 * Binds localhost by default; Caddy terminates TLS and forwards /mcp. Requires
 * `FARSYN_API_TOKEN` — same bearer the farsyn console API uses.
 */
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { readBearer, verifyApiToken, withLegacyEnv } from "@farsyn/engine/mcp.js";
import type { NextFunction, Request, Response } from "express";
import { createFarsynMcpServer } from "./index.js";
import { createMcpConfig, type McpConfig } from "./deps.js";

/** Host headers accepted when sitting behind Caddy (see `FARSYN_MCP_ALLOWED_HOSTS`). */
export function parseAllowedHosts(
  env: NodeJS.ProcessEnv,
  serverUrl: string | null,
): string[] | undefined {
  const raw = env.FARSYN_MCP_ALLOWED_HOSTS;
  if (raw !== undefined && raw !== "") {
    return raw.split(",").map((h) => h.trim()).filter((h) => h.length > 0);
  }
  if (serverUrl !== null) {
    try {
      const hostname = new URL(serverUrl).hostname;
      return [hostname, "127.0.0.1", "localhost"];
    } catch {
      /* fall through */
    }
  }
  return undefined;
}

export function requireBearerToken(configured: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const presented = readBearer(req.headers.authorization);
    if (presented === null || !verifyApiToken(presented, configured)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

async function handleMcpRequest(config: McpConfig, req: Request, res: Response): Promise<void> {
  const server = createFarsynMcpServer(config);
  try {
    const transport = new StreamableHTTPServerTransport({});
    await server.connect(transport as unknown as Transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    console.error("farsyn MCP HTTP error:", error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

export function createHttpApp(config: McpConfig, env: NodeJS.ProcessEnv = withLegacyEnv(process.env)) {
  const apiToken = config.apiToken;
  if (apiToken === null) {
    throw new Error("FARSYN_API_TOKEN is required for HTTP MCP");
  }

  const host = env.FARSYN_MCP_HOST ?? "127.0.0.1";
  const allowedHosts = parseAllowedHosts(env, config.serverUrl);

  const app = createMcpExpressApp({
    host,
    ...(allowedHosts !== undefined ? { allowedHosts } : {}),
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "farsyn-mcp" });
  });

  app.get("/mcp/health", (_req, res) => {
    res.json({ ok: true, service: "farsyn-mcp" });
  });

  app.use("/mcp", requireBearerToken(apiToken));
  app.all("/mcp", (req, res) => {
    void handleMcpRequest(config, req, res);
  });

  return app;
}

export async function startHttpServer(rawEnv: NodeJS.ProcessEnv = process.env): Promise<void> {
  const env = withLegacyEnv(rawEnv);
  const config = createMcpConfig(env);
  const host = env.FARSYN_MCP_HOST ?? "127.0.0.1";
  const port = Number(env.FARSYN_MCP_PORT ?? "4181");
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`invalid FARSYN_MCP_PORT: ${env.FARSYN_MCP_PORT ?? ""}`);
  }

  const app = createHttpApp(config, env);

  await new Promise<void>((resolve, reject) => {
    app.listen(port, host, (err?: Error) => {
      if (err !== undefined) reject(err);
      else resolve();
    });
  });

  console.error(`farsyn MCP HTTP ready — http://${host}:${port}/mcp`);
  console.error(`  evidence ${config.evidenceRoot}`);
}

async function main(): Promise<void> {
  await startHttpServer();
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("/http.ts") ||
    process.argv[1].endsWith("\\http.ts") ||
    process.argv[1].includes("farsyn-mcp-http"));

if (isMain) {
  main().catch((err: unknown) => {
    console.error("farsyn MCP HTTP fatal:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
