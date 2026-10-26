"use client";

import { useState } from "react";
import { Check, Copy, Code, Download, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TextPreviewProps {
  text: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
}

export default function TextPreview({
  text,
  language = "text",
  showLineNumbers = true,
  maxHeight = "520px",
}: TextPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archivo.${language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lines = text.split("\n");

  return (
    <motion.div
      className="relative rounded-3xl liquid-glass overflow-hidden shadow-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Code Header Bar */}
      <div className="px-4 py-2.5 bg-zinc-100/70 dark:bg-zinc-800/80 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300">
            <Code size={13} />
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-600 dark:text-zinc-400">
            {language}
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
            ({lines.length} {lines.length === 1 ? "línea" : "líneas"})
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <motion.button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
            title={isExpanded ? "Contraer visor" : "Expandir visor"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </motion.button>

          <motion.button
            type="button"
            onClick={handleDownload}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
            title="Descargar archivo"
          >
            <Download size={14} />
          </motion.button>

          <motion.button
            type="button"
            onClick={handleCopy}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
            title="Copiar contenido"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.div key="check" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                  <Check size={14} className="text-emerald-500" />
                </motion.div>
              ) : (
                <motion.div key="copy" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                  <Copy size={14} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Code Content */}
      <div
        className="overflow-auto p-4 font-mono text-xs sm:text-sm leading-relaxed"
        style={{ maxHeight: isExpanded ? "none" : maxHeight }}
      >
        <div className="flex">
          {showLineNumbers && (
            <div className="mr-4 select-none text-right font-mono text-zinc-400 dark:text-zinc-600 border-r border-zinc-200/60 dark:border-zinc-800/60 pr-3 tabular-nums">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-x-auto text-zinc-800 dark:text-zinc-200">
            <pre className="font-mono whitespace-pre">{text}</pre>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
