import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

export function VideoPlayer({ src, poster, onBack, title }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // Garante que o elemento de vídeo existe
    if (!videoRef.current) return;

    const videoElement = document.createElement("video-js");
    videoElement.classList.add("vjs-big-play-centered", "vjs-fluid");
    videoRef.current.appendChild(videoElement);

    const player = (playerRef.current = videojs(videoElement, {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      poster: poster,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      sources: [
        {
          src: src,
          type: src.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4",
        },
      ],
      userActions: {
        hotkeys: true,
      },
    }));

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster]);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden flex flex-col justify-center">
      {/* Barra de cabeçalho sobreposta com botão de voltar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 transition"
        >
          ← Voltar para o Catálogo
        </button>
        {title && <span className="text-sm font-semibold text-gray-200">{title}</span>}
      </div>

      <div data-vjs-player className="w-full h-full flex items-center justify-center">
        <div ref={videoRef} className="w-full max-h-screen" />
      </div>
    </div>
  );
}
