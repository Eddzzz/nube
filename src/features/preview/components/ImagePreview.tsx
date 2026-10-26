"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, ZoomIn, ZoomOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImagePreviewProps {
  src: string;
  alt: string;
  maxHeight?: string;
}

export default function ImagePreview({ src, alt, maxHeight = "65vh" }: ImagePreviewProps) {
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(src);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleZoom = () => setIsZoomed(!isZoomed);

  return (
    <div className="relative inline-block w-full text-center group">
      <motion.div
        layout
        className="relative inline-block overflow-hidden rounded-3xl liquid-glass shadow-xl"
      >
        <motion.img
          src={src}
          alt={alt}
          style={{ maxHeight: isZoomed ? "90vh" : maxHeight }}
          className={`max-w-full h-auto object-contain transition-all duration-300 ${
            isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
          }`}
          onClick={toggleZoom}
          whileHover={{ scale: 1.005 }}
        />

        {/* Action Controls in Corner */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 p-1 rounded-2xl liquid-glass-dock text-white opacity-90 group-hover:opacity-100 transition-opacity">
          <motion.a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </motion.a>

          <motion.button
            type="button"
            onClick={handleCopy}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="Copiar URL"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.div key="checked" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </motion.div>
              ) : (
                <motion.div key="copy" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                  <Copy className="w-3.5 h-3.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            type="button"
            onClick={toggleZoom}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title={isZoomed ? "Reducir" : "Ampliar"}
          >
            {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
