import es from "@/i18n/dictionaries/es";
import type { Locale, Dictionary } from "@/i18n/I18nProvider";

export type { Locale, Dictionary };

export async function getLocale(): Promise<Locale> {
  return "es";
}

export async function getDict(): Promise<{ locale: Locale; dict: Dictionary }> {
  return { locale: await getLocale(), dict: es };
}
