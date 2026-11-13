import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { createServer as createViteServer } from "vite";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_CONFIG_FILE = path.resolve(process.cwd(), ".supabase-public.json");

interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

function isSecretSupabaseKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.startsWith("sb_secret_")) {
    return true;
  }
  const parts = trimmed.split(".");
  if (parts.length === 3) {
    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { role?: string };
      if (payload && (payload.role === "service_role" || payload.role === "supabase_admin")) {
        return true;
      }
    } catch {
      // Ignore malformed JWT payloads
    }
  }
  return false;
}

function isValidHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function readPublicConfig(): {
  configured: boolean;
  url: string;
  anonKey: string;
  source: "env" | "server-file" | "none";
} {
  const envUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const envAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();

  if (envUrl && envAnonKey && isValidHttpsUrl(envUrl) && !isSecretSupabaseKey(envAnonKey)) {
    return { configured: true, url: envUrl, anonKey: envAnonKey, source: "env" };
  }

  try {
    if (fs.existsSync(PUBLIC_CONFIG_FILE)) {
      const raw = fs.readFileSync(PUBLIC_CONFIG_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<PublicSupabaseConfig>;
      const fileUrl = String(parsed.url || "").trim().replace(/\/+$/, "");
      const fileAnonKey = String(parsed.anonKey || "").trim();
      if (fileUrl && fileAnonKey && isValidHttpsUrl(fileUrl) && !isSecretSupabaseKey(fileAnonKey)) {
        return { configured: true, url: fileUrl, anonKey: fileAnonKey, source: "server-file" };
      }
    }
  } catch (err) {
    console.warn("Aviso ao ler configuração pública do Supabase:", err);
  }

  return { configured: false, url: "", anonKey: "", source: "none" };
}

async function verifySupabaseAccessToken(supabaseUrl: string, anonKey: string, bearerToken: string): Promise<boolean> {
  if (!bearerToken) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${bearerToken}`
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  // Endpoint público para que visitantes anônimos recebam URL e Anon Key públicas (nunca service_role)
  app.get("/api/public-config", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(readPublicConfig());
  });

  // Sincronização da configuração pública pelo administrador (protegida após primeira configuração)
  app.post("/api/public-config", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const body = (req.body || {}) as Partial<PublicSupabaseConfig>;
    const url = String(body.url || "").trim().replace(/\/+$/, "");
    const anonKey = String(body.anonKey || "").trim();

    if (!url || !anonKey) {
      res.status(400).json({ error: "SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios." });
      return;
    }

    if (!isValidHttpsUrl(url)) {
      res.status(400).json({ error: "URL do Supabase inválida. Deve começar com https://" });
      return;
    }

    if (isSecretSupabaseKey(anonKey)) {
      res.status(403).json({
        error: "Chave secreta (sb_secret_ ou service_role) não é permitida no navegador nem nesta rota."
      });
      return;
    }

    const current = readPublicConfig();
    if (current.source === "env") {
      res.status(200).json({ ok: true, source: "env", message: "Configuração controlada pelas variáveis de ambiente." });
      return;
    }

    if (current.configured && (current.url !== url || current.anonKey !== anonKey)) {
      const authHeader = String(req.headers.authorization || "");
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const isAuthorized = await verifySupabaseAccessToken(current.url, current.anonKey, token);
      if (!isAuthorized) {
        res.status(401).json({
          error: "Já existe um projeto Supabase vinculado. Faça login como administrador para alterá-lo."
        });
        return;
      }
    }

    try {
      fs.writeFileSync(
        PUBLIC_CONFIG_FILE,
        JSON.stringify({ url, anonKey }, null, 2),
        "utf8"
      );
      res.json({ ok: true, source: "server-file" });
    } catch (err) {
      console.error("Erro ao salvar configuração pública do Supabase:", err);
      res.status(500).json({ error: "Falha ao persistir configuração pública no servidor." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor Emerson Carvalho rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
