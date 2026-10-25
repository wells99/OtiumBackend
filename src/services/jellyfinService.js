import { env } from "../config/env.js";

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `MediaBrowser Client="OtiumPlayer", Device="Server", DeviceId="OtiumPlayer-Backend", Version="1.0.0", Token="${env.jellyfinApiKey}"`,
  "X-Emby-Token": env.jellyfinApiKey,
});

/**
 * Cria um novo usuário no Jellyfin com usuário e senha
 */
export async function createUser(username, password) {
  const response = await fetch(`${env.jellyfinUrl}/Users/New`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      Name: username,
      Password: password,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 400 || response.status === 409) {
      const err = new Error("Usuário já existe ou nome inválido no Jellyfin.");
      err.statusCode = 409;
      throw err;
    }
    const err = new Error(`Falha ao criar usuário no Jellyfin: ${response.status}`);
    err.statusCode = 502;
    err.details = errorText;
    throw err;
  }

  return response.json();
}

/**
 * Busca detalhes e a política (Policy) de um usuário no Jellyfin
 */
export async function getUser(userId) {
  const response = await fetch(`${env.jellyfinUrl}/Users/${userId}`, {
    method: "GET",
    headers: getHeaders(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const err = new Error(`Usuário não encontrado no Jellyfin: ${response.status}`);
    err.statusCode = response.status === 404 ? 404 : 502;
    throw err;
  }

  return response.json();
}

/**
 * Atualiza a política do usuário para desativar ou reativar (IsDisabled: true/false)
 */
export async function setUserDisabledState(userId, isDisabled) {
  // Primeiro, obtém a política atual do usuário para preservar outras permissões
  const user = await getUser(userId);
  const currentPolicy = user.Policy || {};

  const updatedPolicy = {
    ...currentPolicy,
    IsDisabled: isDisabled,
  };

  const response = await fetch(`${env.jellyfinUrl}/Users/${userId}/Policy`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(updatedPolicy),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const err = new Error(`Falha ao alterar estado do usuário no Jellyfin: ${response.status}`);
    err.statusCode = 502;
    err.details = errorText;
    throw err;
  }

  // Se o usuário foi desativado, encerra sessões ativas imediatamente
  if (isDisabled) {
    await terminateUserSessions(userId).catch((e) => {
      console.warn(`Não foi possível derrubar sessões ativas do usuário ${userId}:`, e.message);
    });
  }

  return true;
}

/**
 * Encerra todas as sessões ativas de streaming do usuário
 */
export async function terminateUserSessions(userId) {
  try {
    const sessionsResponse = await fetch(`${env.jellyfinUrl}/Sessions`, {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    if (!sessionsResponse.ok) return;

    const sessions = await sessionsResponse.json();
    const userSessions = sessions.filter((s) => s.UserId === userId);

    for (const session of userSessions) {
      if (session.Id) {
        await fetch(`${env.jellyfinUrl}/Sessions/Logout`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ SessionId: session.Id }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Erro ao listar/derrubar sessões:", err.message);
  }
}
