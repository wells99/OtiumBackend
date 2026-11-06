import { randomUUID } from "node:crypto";
import cron from "node-cron";
import prisma from "../config/database.js";
import { env } from "../config/env.js";
import * as jellyfinService from "../services/jellyfinService.js";

const QUALITY_1080P_FORMAT = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo+bestaudio/best";
const MAX_VIDEOS_PER_CYCLE = 20;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 60 * 60 * 1000;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
let isRunning = false;
const WORKER_LOCK_ID = "youtube-channel-sync";
const WORKER_LOCK_MS = 30 * 60 * 1000;

function decodeXml(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

async function fetchYoutube(url, options = {}, timeoutMs = 15000) {
  let target = new URL(url);
  if (target.protocol !== "https:" || !YOUTUBE_HOSTS.has(target.hostname)) throw new Error("youtube-host-not-allowed");
  let response;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    response = await fetch(target, { ...options, signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === 5) throw new Error("youtube-redirect-limit");
    target = new URL(location, target);
    if (target.protocol !== "https:" || !YOUTUBE_HOSTS.has(target.hostname) || target.username || target.password) {
      throw new Error("youtube-redirect-host-not-allowed");
    }
  }
  throw new Error("youtube-redirect-limit");
}

async function fetchChannelVideos(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const response = await fetchYoutube(url, { headers: { "User-Agent": "OtiumFlix/1.0" } });
  if (!response.ok) throw new Error(`youtube-feed-http-${response.status}`);
  const xml = await response.text();
  if (!/<feed\b/i.test(xml) || !xml.includes(channelId)) throw new Error("youtube-feed-invalid");

  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(([, entry]) => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1]?.trim();
    const title = entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/i)?.[1];
    if (!videoId || !title || !publishedAt) return null;
    const publishedDate = new Date(publishedAt);
    if (Number.isNaN(publishedDate.getTime())) return null;
    return { id: videoId, title: decodeXml(title).slice(0, 5000), publishedAt: publishedDate };
  }).filter(Boolean);
}

async function isShort(videoId) {
  const url = `https://www.youtube.com/shorts/${videoId}`;
  try {
    const response = await fetchYoutube(url, { method: "HEAD", headers: { "User-Agent": "OtiumFlix/1.0" } }, 8000);
    if ([301, 302, 303, 307, 308].includes(response.status)) return false;
    if (![200, 405].includes(response.status)) throw new Error(`youtube-short-check-http-${response.status}`);

    const page = await fetchYoutube(url, { method: "GET", headers: { "User-Agent": "OtiumFlix/1.0" } }, 10000);
    if ([301, 302, 303, 307, 308].includes(page.status)) return false;
    if (!page.ok) throw new Error(`youtube-short-check-http-${page.status}`);
    const html = await page.text();
    const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1]
      || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1]
      || html.match(/"urlCanonical"\s*:\s*"([^"]+)"/i)?.[1];
    if (canonical) {
      const canonicalUrl = new URL(canonical);
      if (canonicalUrl.hostname === "www.youtube.com" && canonicalUrl.pathname === `/shorts/${videoId}`) return true;
      if (canonicalUrl.hostname === "www.youtube.com" && canonicalUrl.pathname === "/watch" && canonicalUrl.searchParams.get("v") === videoId) return false;
    }
    if (new RegExp(`"videoId"\\s*:\\s*"${videoId}"[\\s\\S]{0,500}"isShorts"\\s*:\\s*true`).test(html)) return true;
    throw new Error("youtube-short-check-ambiguous");
  } catch (error) {
    if (error.message.startsWith("youtube-short-check-")) throw error;
    throw new Error("youtube-short-check-unavailable", { cause: error });
  }
}

async function isPublicVideo(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
  let response;
  try {
    response = await fetchYoutube(oembedUrl, { headers: { "User-Agent": "OtiumFlix/1.0" } }, 10000);
  } catch (error) {
    const reason = error?.cause?.code || error?.name || "fetch-error";
    throw new Error(`youtube-visibility-check-unavailable:${reason}`, { cause: error });
  }
  if (!response.ok) throw new Error(`youtube-visibility-http-${response.status}`);
  const metadata = await response.json().catch(() => null);
  if (!metadata || typeof metadata.title !== "string") throw new Error("youtube-visibility-metadata-invalid");
  return true;
}

async function metubeRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${env.youtubeMetubeUrl}/${path}`, {
      ...options,
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const reason = error?.cause?.code || error?.name || "fetch-error";
    throw new Error(`metube-unavailable: ${reason}`, { cause: error });
  }
  if (!response.ok) throw new Error(`metube-http-${response.status}`);
  return response.json().catch(() => ({}));
}

function retryDate(attempts, now) {
  const backoffMs = Math.min(RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1)), 48 * 60 * 60 * 1000);
  return new Date(now.getTime() + backoffMs);
}

function videoIdFromUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (!new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]).has(parsed.hostname)) return null;
    return parsed.searchParams.get("v") || parsed.pathname.match(/^\/shorts\/([\w-]{11})/)?.[1] || null;
  } catch {
    return null;
  }
}

async function refreshQueuedStatuses(history) {
  const entries = ["queue", "pending", "done"].flatMap((group) =>
    Array.isArray(history?.[group]) ? history[group].map((item) => ({ ...item, group })) : []
  );
  const queuedVideos = await prisma.youtubeVideo.findMany({ where: { status: "queued", metubeJobId: { not: null } } });
  let downloadedCount = 0;
  for (const video of queuedVideos) {
    const job = entries.find((item) => item.id === video.metubeJobId);
    if (!job) continue;
    if (job.group !== "done") continue;
    const now = new Date();
    if (job.error || job.status === "error" || job.status === "failed") {
      await prisma.youtubeVideo.update({
        where: { id: video.id },
        data: {
          status: "failed",
          lastError: "MeTube não concluiu o download.",
          nextRetryAt: video.attempts < MAX_ATTEMPTS ? retryDate(video.attempts, now) : null,
        },
      });
    } else if (["finished", "completed", "success"].includes(job.status)) {
      await prisma.youtubeVideo.update({
        where: { id: video.id },
        data: { status: "downloaded", downloadedAt: now, lastError: null, nextRetryAt: null },
      });
      downloadedCount += 1;
    }
  }
  return downloadedCount;
}

async function recoverInterruptedSubmissions(history, now) {
  const interruptedBefore = new Date(now.getTime() - 30 * 60 * 1000);
  const interrupted = await prisma.youtubeVideo.findMany({
    where: { status: "processing", updatedAt: { lt: interruptedBefore } },
  });
  const entries = ["queue", "pending", "done"].flatMap((group) =>
    Array.isArray(history?.[group]) ? history[group].map((item) => ({ ...item, group })) : []
  );
  let downloadedCount = 0;

  for (const video of interrupted) {
    const job = entries.find((item) => {
      const recentEnough = Number(item.timestamp || 0) >= video.updatedAt.getTime() * 1_000_000;
      const idMatches = typeof item.id === "string" && item.id.startsWith(`${video.id}.`);
      return recentEnough && (idMatches || videoIdFromUrl(item.url) === video.id);
    });
    if (job) {
      if (job.group === "done" && ["finished", "completed", "success"].includes(job.status)) {
        await prisma.youtubeVideo.update({
          where: { id: video.id },
          data: { status: "downloaded", downloadedAt: now, metubeJobId: job.id, lastError: null },
        });
        downloadedCount += 1;
      } else {
        await prisma.youtubeVideo.update({
          where: { id: video.id },
          data: { status: "queued", queuedAt: now, metubeJobId: job.id },
        });
      }
    } else {
      await prisma.youtubeVideo.update({
        where: { id: video.id },
        data: {
          status: "failed",
          lastError: "Tentativa interrompida antes da confirmação do MeTube.",
          nextRetryAt: video.attempts < MAX_ATTEMPTS ? now : null,
        },
      });
    }
  }
  return downloadedCount;
}

async function checkMetubeConfiguration() {
  const status = await metubeRequest("cookie-status");
  if (status.has_cookies === true) {
    throw new Error("metube-cookie-auth-configured");
  }
}

async function saveFeedEntries(channel, entries) {
  const newEntries = entries.filter((video) => video.publishedAt >= channel.addedAt);
  if (newEntries.length === 0) return;
  await prisma.youtubeVideo.createMany({
    data: newEntries.map((video) => ({
      id: video.id,
      channelId: channel.id,
      title: video.title,
      publishedAt: video.publishedAt,
    })),
    skipDuplicates: true,
  });
}

async function submitVideo(video) {
  const claim = await prisma.youtubeVideo.updateMany({
    where: {
      id: video.id,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { status: "discovered" },
        { status: "failed", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
      ],
    },
    data: { status: "processing", attempts: { increment: 1 }, lastError: null, nextRetryAt: null },
  });
  if (claim.count !== 1) return false;

  const now = new Date();
  try {
    await isPublicVideo(video.id);
    if (await isShort(video.id)) {
      console.info(`[YouTube Worker] Vídeo ${video.id} ignorado: o YouTube confirmou que é um Short.`);
      await prisma.youtubeVideo.update({ where: { id: video.id }, data: { status: "ignored", lastError: null } });
      return false;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const accepted = await metubeRequest("add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: videoUrl,
        quality: "best",
        download_type: "video",
        format: "mp4",
        auto_start: true,
        ytdl_options_overrides: {
          format: QUALITY_1080P_FORMAT,
          format_sort: ["vcodec:h264", "ext:mp4:m4a"],
        },
      }),
    });
    if (accepted.status === "error" || accepted.status === "failed") throw new Error("metube-rejected-job");

    let metubeJobId = typeof accepted.id === "string" ? accepted.id : null;
    if (!metubeJobId) {
      try {
        const history = await metubeRequest("history");
        const matching = ["queue", "pending", "done"]
          .flatMap((group) => Array.isArray(history?.[group]) ? history[group] : [])
          .filter((job) => videoIdFromUrl(job.url) === video.id)
          .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))[0];
        metubeJobId = typeof matching?.id === "string" ? matching.id : null;
      } catch {
        // The accepted job remains queued in MySQL even if history is temporarily unavailable.
      }
    }

    await prisma.youtubeVideo.update({
      where: { id: video.id },
      data: { status: "queued", queuedAt: now, metubeJobId },
    });
    return true;
  } catch (error) {
    const current = await prisma.youtubeVideo.findUnique({ where: { id: video.id }, select: { attempts: true } });
    await prisma.youtubeVideo.update({
      where: { id: video.id },
      data: {
        status: "failed",
        lastError: error.message.startsWith("youtube-") ? "Não foi possível confirmar a disponibilidade pública do vídeo." : "Não foi possível enviar o vídeo para download.",
        nextRetryAt: current.attempts < MAX_ATTEMPTS ? retryDate(current.attempts, now) : null,
      },
    });
    console.warn(`[YouTube Worker] Falha no vídeo ${video.id}: ${error.message}`);
    return false;
  }
}

export async function runYoutubeChannelCheck() {
  if (isRunning || !env.youtubeChannelsWorkerEnabled) return { skipped: true };
  isRunning = true;
  const now = new Date();
  let queued = 0;
  let checked = 0;
  let processedVideos = 0;
  let lockToken = null;
  try {
    const ownerToken = randomUUID();
    const lock = await prisma.youtubeWorkerLock.updateMany({
      where: { id: WORKER_LOCK_ID, lockedUntil: { lt: now } },
      data: { ownerToken, lockedUntil: new Date(now.getTime() + WORKER_LOCK_MS) },
    });
    if (lock.count !== 1) return { skipped: true, reason: "worker-lock-held" };
    lockToken = ownerToken;

    await checkMetubeConfiguration();
    const history = await metubeRequest("history");
    const completedDownloads = (await refreshQueuedStatuses(history)) + (await recoverInterruptedSubmissions(history, now));
    if (completedDownloads > 0) {
      await jellyfinService.refreshLibrary().catch((error) => {
        console.error(`[YouTube Worker] Download concluído, mas não foi possível iniciar o rescan Jellyfin: ${error.message}`);
      });
    }

    const channels = await prisma.youtubeChannel.findMany({
      where: {
        users: {
          some: {
            status: "active",
            user: {
              plan: { is: { active: true } },
              OR: [
                { status: "trial_ativo", trialEndsAt: { gt: now } },
                { status: "ativo", OR: [{ subscriptionEndsAt: null }, { subscriptionEndsAt: { gt: now } }] },
              ],
            },
          },
        },
      },
      orderBy: { lastCheckedAt: "asc" },
    });

    for (const channel of channels) {
      try {
        const entries = await fetchChannelVideos(channel.id);
        await saveFeedEntries(channel, entries);
        const candidates = await prisma.youtubeVideo.findMany({
          where: {
            id: { in: entries.map(({ id }) => id) },
            channelId: channel.id,
            publishedAt: { gte: channel.addedAt },
            attempts: { lt: MAX_ATTEMPTS },
            OR: [
              { status: "discovered" },
              { status: "failed", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
            ],
          },
          orderBy: { publishedAt: "asc" },
          take: MAX_VIDEOS_PER_CYCLE - processedVideos,
        });
        for (const video of candidates) {
          if (processedVideos >= MAX_VIDEOS_PER_CYCLE) break;
          processedVideos += 1;
          if (await submitVideo(video)) queued += 1;
        }
      } catch (error) {
        console.warn(`[YouTube Worker] Falha no canal ${channel.id}: ${error.message}`);
      } finally {
        await prisma.youtubeChannel.update({ where: { id: channel.id }, data: { lastCheckedAt: new Date() } });
        checked += 1;
        await prisma.youtubeWorkerLock.updateMany({
          where: { id: WORKER_LOCK_ID, ownerToken: lockToken },
          data: { lockedUntil: new Date(Date.now() + WORKER_LOCK_MS) },
        });
      }
      if (processedVideos >= MAX_VIDEOS_PER_CYCLE) break;
    }
    console.info(`[YouTube Worker] Ciclo concluído: ${checked} canais consultados, ${processedVideos} vídeos avaliados, ${queued} downloads enviados ao MeTube.`);
    return { checked, processedVideos, queued };
  } catch (error) {
    console.error(`[YouTube Worker] Ciclo interrompido: ${error.message}`);
    return { checked, processedVideos, queued, error: error.message };
  } finally {
    if (lockToken) {
      await prisma.youtubeWorkerLock.updateMany({
        where: { id: WORKER_LOCK_ID, ownerToken: lockToken },
        data: { ownerToken: null, lockedUntil: new Date() },
      }).catch((error) => console.error(`[YouTube Worker] Não foi possível liberar o lock: ${error.message}`));
    }
    isRunning = false;
  }
}

export function initYoutubeChannelWorker() {
  if (!env.youtubeChannelsWorkerEnabled) {
    console.info("[YouTube Worker] Desativado por configuração.");
    return null;
  }
  if (!cron.validate(env.youtubeChannelsCheckCron)) {
    throw new Error("YOUTUBE_CHANNELS_CHECK_CRON não contém uma expressão cron válida.");
  }
  const task = cron.schedule(env.youtubeChannelsCheckCron, () => {
    void runYoutubeChannelCheck();
  }, { timezone: "America/Sao_Paulo" });
  console.info(`[YouTube Worker] Agendado com '${env.youtubeChannelsCheckCron}' no fuso America/Sao_Paulo.`);
  void runYoutubeChannelCheck();
  return task;
}
