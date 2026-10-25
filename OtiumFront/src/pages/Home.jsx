import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar.jsx";
import { jellyfinService } from "../services/jellyfinService.js";
import { Play, Film } from "lucide-react";

export function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCatalog() {
      const data = await jellyfinService.getLatestItems();
      setItems(data);
      setLoading(false);
    }
    loadCatalog();
  }, []);

  const heroItem = items.length > 0 ? items[0] : null;

  return (
    <div className="min-h-screen bg-[#0b0c10] pb-20">
      <Navbar />

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-500 border-t-transparent"></div>
        </div>
      ) : (
        <main>
          {/* Banner Hero */}
          {heroItem && (
            <div className="relative h-[65vh] w-full overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${jellyfinService.getBackdropUrl(heroItem.Id)})`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/70 to-transparent" />
              </div>

              <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-12 sm:px-6 lg:px-8">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                  Destaque
                </span>
                <h1 className="mt-2 text-4xl font-extrabold text-white sm:text-5xl lg:text-6xl">
                  {heroItem.Name}
                </h1>
                {heroItem.Overview && (
                  <p className="mt-3 max-w-2xl text-sm text-gray-300 line-clamp-3">
                    {heroItem.Overview}
                  </p>
                )}

                <div className="mt-6 flex items-center gap-4">
                  <button
                    onClick={() => navigate(`/watch/${heroItem.Id}`)}
                    className="flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500"
                  >
                    <Play className="h-5 w-5 fill-white" />
                    Assistir Agora
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Seção de Catálogo */}
          <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Catálogo de Mídias</h2>
              <span className="text-xs text-gray-400">{items.length} itens disponíveis</span>
            </div>

            {items.length === 0 ? (
              <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/30 p-12 text-center">
                <Film className="h-12 w-12 text-gray-600" />
                <p className="mt-4 text-base font-medium text-gray-300">
                  Nenhum vídeo retornado pelo Jellyfin no momento.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Verifique se o servidor Jellyfin está ligado e com mídias escaneadas na biblioteca.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {items.map((item) => (
                  <div
                    key={item.Id}
                    onClick={() => navigate(`/watch/${item.Id}`)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl bg-gray-800 transition hover:scale-105 hover:shadow-xl hover:shadow-rose-950/40"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden bg-gray-900">
                      <img
                        src={jellyfinService.getPosterUrl(item.Id)}
                        alt={item.Name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:opacity-80"
                        onError={(e) => {
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%231f2937'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='sans-serif' font-size='14'%3ESem Capa%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg">
                        <Play className="h-6 w-6 fill-white ml-0.5" />
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="truncate text-xs font-semibold text-white group-hover:text-rose-400">
                        {item.Name}
                      </h3>
                      {item.ProductionYear && (
                        <p className="mt-0.5 text-[11px] text-gray-400">{item.ProductionYear}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
