import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import * as jellyfinService from "./jellyfinService.js";

const normalize = (value) => String(value || "").trim().toLocaleLowerCase("pt-BR");

export const userSyncService = {
  async preview() {
    const [jellyfinUsers, databaseUsers] = await Promise.all([
      jellyfinService.getUsers(),
      userRepository.findAll(),
    ]);
    const dbByName = new Map(databaseUsers.map((user) => [normalize(user.username), user]));
    const jfByName = new Map(jellyfinUsers.map((user) => [normalize(user.Name), user]));

    return {
      jellyfinOnly: jellyfinUsers
        .filter((user) => !dbByName.has(normalize(user.Name)))
        .map(({ Id, Name, Policy }) => ({ id: Id, username: Name, disabled: Boolean(Policy?.IsDisabled) })),
      databaseOnly: databaseUsers
        .filter((user) => !jfByName.has(normalize(user.username)))
        .map(({ id, username, status }) => ({ id, username, status })),
      linked: databaseUsers.filter((user) => jfByName.has(normalize(user.username))).length,
    };
  },

  async importJellyfinUsers() {
    const jellyfinUsers = await jellyfinService.getUsers();
    const results = { imported: [], linked: [], unchanged: [], conflicts: [] };

    for (const jfUser of jellyfinUsers) {
      if (!jfUser.Id || !jfUser.Name) continue;
      const existing = await userRepository.findByUsername(jfUser.Name);
      if (existing) {
        if (existing.jellyfinUserId === jfUser.Id) {
          results.unchanged.push(jfUser.Name);
        } else if (!existing.jellyfinUserId) {
          await userRepository.update(existing.id, { jellyfinUserId: jfUser.Id });
          results.linked.push(jfUser.Name);
        } else {
          results.conflicts.push({ username: jfUser.Name, reason: "O usuário já está vinculado a outro ID Jellyfin." });
        }
        continue;
      }

      const now = new Date();
      await userRepository.create({
        username: jfUser.Name,
        jellyfinUserId: jfUser.Id,
        passwordHash: null,
        status: jfUser.Policy?.IsDisabled ? "bloqueado" : "ativo",
        trialEndsAt: now,
      });
      results.imported.push(jfUser.Name);
    }
    return results;
  },

  async exportDatabaseUsers(passwords) {
    if (!passwords || typeof passwords !== "object" || Array.isArray(passwords)) {
      const err = new Error("Informe uma senha atual para cada conta que precisar ser criada no Jellyfin.");
      err.statusCode = 400;
      throw err;
    }

    const [jellyfinUsers, databaseUsers] = await Promise.all([
      jellyfinService.getUsers(),
      userRepository.findAll(),
    ]);
    const jfByName = new Map(jellyfinUsers.map((user) => [normalize(user.Name), user]));
    const results = { created: [], linked: [], unchanged: [], failed: [] };

    for (const user of databaseUsers) {
      const existingJf = jfByName.get(normalize(user.username));
      if (existingJf) {
        if (user.jellyfinUserId && user.jellyfinUserId !== existingJf.Id) {
          results.failed.push({ username: user.username, error: "O vínculo atual aponta para outro ID Jellyfin." });
        } else if (!user.jellyfinUserId) {
          await userRepository.update(user.id, { jellyfinUserId: existingJf.Id });
          results.linked.push(user.username);
        } else {
          results.unchanged.push(user.username);
        }
        continue;
      }

      const password = passwords[user.username];
      if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        results.failed.push({ username: user.username, error: "Informe a senha atual (8 a 128 caracteres) para criar esta conta." });
        continue;
      }
      if (user.passwordHash && !(await bcrypt.compare(password, user.passwordHash))) {
        results.failed.push({ username: user.username, error: "A senha informada não corresponde à senha atual do banco." });
        continue;
      }

      try {
        const jfUser = await jellyfinService.createUser(user.username, password);
        const updates = { jellyfinUserId: jfUser.Id };
        if (!user.passwordHash) updates.passwordHash = await bcrypt.hash(password, 10);
        await userRepository.update(user.id, updates);
        results.created.push(user.username);
      } catch (err) {
        results.failed.push({ username: user.username, error: err.message });
      }
    }
    return results;
  },
};
