import { ExternalLink } from "lucide-react";

export default function PdfPreview({ src, name }: { src: string; name: string }) {
  return (
    <section aria-label="Documento PDF" className="space-y-3">
      <div className="overflow-hidden rounded-3xl liquid-glass shadow-xl p-1">
        <iframe
          src={src}
          title={`Vista previa PDF: ${name}`}
          className="w-full rounded-2xl"
          style={{ height: "74vh", minHeight: 380 }}
          referrerPolicy="same-origin"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>Visor de documentos PDF</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <span>Abrir en nueva pestaña</span>
          <ExternalLink size={12} />
        </a>
      </div>
    </section>
  );
}
