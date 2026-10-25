import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VideoPlayer } from "../components/player/VideoPlayer.jsx";
import { jellyfinService } from "../services/jellyfinService.js";
import { useAuth } from "../context/AuthContext.jsx";

export function Watch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isTrialExpired } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isTrialExpired) {
      navigate("/checkout");
      return;
    }

    async function loadItem() {
      const data = await jellyfinService.getItemDetails(id);
      setItem(data);
      setLoading(false);
    }

    loadItem();
  }, [id, isTrialExpired, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  const streamUrl = jellyfinService.getStreamUrl(id);
  const posterUrl = jellyfinService.getBackdropUrl(id) || jellyfinService.getPosterUrl(id);

  return (
    <VideoPlayer
      src={streamUrl}
      poster={posterUrl}
      title={item?.Name}
      onBack={() => navigate("/")}
    />
  );
}
