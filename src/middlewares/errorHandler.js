export function errorHandler(err, _req, res, _next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido enviado na requisição." });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Erro interno do servidor.";

  if (statusCode >= 500) {
    console.error("Erro interno inesperado:", err);
  }

  return res.status(statusCode).json({
    error: message,
    ...(err.accountStatus ? { accountStatus: err.accountStatus } : {}),
    ...(err.userId ? { userId: err.userId } : {}),
  });
}
