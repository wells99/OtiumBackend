import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function requireUserSyncAccess(req, res, next) {
  if (!env.userSyncEnabled || !env.userSyncKey) {
    return res.status(404).json({ error: "Rota de sincronização indisponível." });
  }

  const supplied = Buffer.from(req.get("x-user-sync-key") || "");
  const expected = Buffer.from(env.userSyncKey);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: "Chave de sincronização inválida." });
  }

  return next();
}
