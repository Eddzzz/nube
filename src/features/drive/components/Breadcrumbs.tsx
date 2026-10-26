// src/features/drive/components/Breadcrumbs.tsx
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { getItem } from "@/services/onedrive/repo";
import HomeLabel from "./HomeLabel";

type PathSegment = {
  id: string;
  name: string;
};

interface BreadcrumbsProps {
  path: PathSegment[];
}

export default function Breadcrumbs({ path }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Ruta de navegación"
      className="flex items-center text-xs sm:text-sm mb-6 py-2 px-3.5 rounded-2xl liquid-glass-pill overflow-x-auto scrollbar-none"
    >
      <Link
        href="/"
        className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium px-2 py-1 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 flex items-center gap-1.5 transition-colors shrink-0"
      >
        <Home size={14} className="shrink-0" />
        <HomeLabel />
      </Link>
      {path.map((segment, index) => {
        const isLast = index === path.length - 1;
        const href = `/files/${path.slice(0, index + 1).map((s) => s.id).join("/")}`;
        return (
          <div key={segment.id} className="flex items-center shrink-0">
            <ChevronRight size={14} className="mx-1 text-zinc-400 dark:text-zinc-600 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 px-2 py-1 truncate max-w-[200px] sm:max-w-[320px]">
                {segment.name}
              </span>
            ) : (
              <Link
                href={href}
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium px-2 py-1 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors truncate max-w-[160px]"
              >
                {segment.name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Generar la ruta de navegación a partir de slug (lista de identificadores).
 * @param slug Lista de identificadores procedente de la URL.
 * @param unknownLabel
 */
export async function generateBreadcrumbs(slug: string[], unknownLabel?: string): Promise<PathSegment[]> {
  const fetches = slug.map((id) =>
    getItem(id)
      .then((item) => ({ id: item.id, name: item.name }))
      .catch((error) => {
        console.error(`No se pudo obtener el elemento ${id} para la ruta de navegación:`, error);
        return { id, name: unknownLabel ?? "[Carpeta desconocida]" };
      })
  );

  return Promise.all(fetches);
}
