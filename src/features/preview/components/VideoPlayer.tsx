"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

export default function VideoPlayer({
  src,
  name,
  canDownload,
}: {
  src: string;
  name: string;
  canDownload: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <section aria-label="Reproductor de video" className="space-y-3">
      <div className="overflow-hidden rounded-3xl liquid-glass shadow-2xl p-1 bg-black">
        <video
          src={src}
          aria-label={`Video: ${name}`}
          controls
          playsInline
          preload="metadata"
          controlsList={canDownload ? undefined : "nodownload"}
          className="w-full max-h-[72vh] object-contain mx-auto rounded-2xl"
          onError={() => setFailed(true)}
          onLoadedMetadata={() => setFailed(false)}
        >
          Tu navegador no admite la reproducción de este video.
        </video>
      </div>

      {failed && (
        <div role="status" className="workspace-error flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>
            No se pudo reproducir el video. El navegador puede no admitir su formato o códec.{" "}
            {canDownload
              ? "Puedes descargarlo para abrirlo en otro reproductor."
              : "Solicita al administrador una copia en formato MP4 compatible."}
          </span>
        </div>
      )}
    </section>
  );
}
