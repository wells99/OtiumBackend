const JELLYFIN_URL = import.meta.env.VITE_JELLYFIN_URL || "http://192.168.1.182:8096";

export const jellyfinService = {
  getPosterUrl(itemId, maxWidth = 400) {
    if (!itemId) return "/placeholder-poster.png";
    return `${JELLYFIN_URL}/Items/${itemId}/Images/Primary?maxWidth=${maxWidth}&quality=90`;
  },

  getBackdropUrl(itemId, maxWidth = 1920) {
    if (!itemId) return "";
    return `${JELLYFIN_URL}/Items/${itemId}/Images/Backdrop/0?maxWidth=${maxWidth}&quality=80`;
  },

  getStreamUrl(itemId) {
    // URL de stream direto ou HLS master playlist
    return `${JELLYFIN_URL}/Videos/${itemId}/stream?static=true`;
  },

  async getLatestItems(userId, limit = 20) {
    try {
      const url = `${JELLYFIN_URL}/Items?Recursive=true&IncludeItemTypes=Movie,Episode&Limit=${limit}&SortBy=DateCreated&SortOrder=Descending`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      return data.Items || [];
    } catch (e) {
      console.warn("Erro ao buscar catálogo do Jellyfin:", e);
      return [];
    }
  },

  async getItemDetails(itemId) {
    try {
      const url = `${JELLYFIN_URL}/Items/${itemId}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error("Erro ao buscar detalhes do item:", e);
      return null;
    }
  },
};
