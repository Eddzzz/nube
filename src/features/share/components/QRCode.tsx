"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Check, Copy } from "lucide-react";
import { generateQR } from "../lib/qr";

interface QRCodeProps {
  value: string;
  size?: number;
  margin?: number;
  className?: string;
  showActions?: boolean;
}

export default function QRCode({
  value,
  size = 220,
  margin = 4,
  className = "",
  showActions = true,
}: QRCodeProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const { matrix, error } = useMemo(() => {
    try {
      return { matrix: generateQR(value), error: null };
    } catch (err) {
      return {
        matrix: null,
        error: err instanceof Error ? err.message : "Error al generar código QR",
      };
    }
  }, [value]);

  if (error || !matrix) {
    return (
      <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-4 text-center text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400">
        {error || "No se pudo generar el código QR"}
      </div>
    );
  }

  const matrixSize = matrix.length;
  const totalCells = matrixSize + margin * 2;

  // Construir SVG path
  let pathD = "";
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + margin;
        const y = r + margin;
        pathD += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  const handleDownloadPng = async () => {
    if (!svgRef.current || downloading) return;
    setDownloading(true);
    try {
      const svgElement = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const URL = window.URL || window.webkitURL || window;
      const blobUrl = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 3; // Alta resolución
        canvas.width = size * scale;
        canvas.height = size * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = "codigo-qr-compartir.png";
          downloadLink.click();
        }
        URL.revokeObjectURL(blobUrl);
        setDownloading(false);
      };
      image.src = blobUrl;
    } catch {
      setDownloading(false);
    }
  };

  const handleCopySvg = async () => {
    if (!svgRef.current) return;
    try {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      await navigator.clipboard.writeText(svgData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar fallo de portapapeles
    }
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-md ring-1 ring-zinc-900/5 dark:ring-white/10">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${totalCells} ${totalCells}`}
          width={size}
          height={size}
          shapeRendering="crispEdges"
          className="block h-auto max-w-full select-none"
        >
          <rect width={totalCells} height={totalCells} fill="#ffffff" />
          <path d={pathD.trim()} fill="#09090b" />
        </svg>
      </div>

      {showActions && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            title="Descargar imagen QR en PNG"
          >
            <Download size={13} />
            <span>Descargar imagen</span>
          </button>
          <button
            type="button"
            onClick={handleCopySvg}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            title="Copiar SVG del QR"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span>{copied ? "Copiado" : "Copiar SVG"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
