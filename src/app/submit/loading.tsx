import MascotLoading from "@/components/ui/MascotLoading";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";

export default async function SubmitLoading() {
  const lang = await getLang();
  return <MascotLoading text={t(lang, "submit.loading")} />;
}
