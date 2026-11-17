// Sonde : lit chaque source d'actus réelle avec le transport sécurisé et résume ce qu'elle donne.
import { createHttpTransport } from "../lib/editorial/fetch.ts";
import { parseFeed } from "../lib/editorial/extract.ts";
import { ACTU_SOURCES, classify } from "../lib/actus/sources.ts";

const transport = createHttpTransport();
for (const s of ACTU_SOURCES) {
  try {
    const items = parseFeed((await transport.get(s.url, "feed")).body);
    const fresh = items.filter((i) => i.publishedAt && Date.now() - i.publishedAt.getTime() < 5 * 86400000);
    const themed = fresh.filter((i) => classify(s, `${i.title} ${i.summary}`));
    const withImg = items.filter((i) => i.image).length;
    console.log(`✔ ${s.name}: ${items.length} éléments, ${fresh.length} de moins de 5 j, ${themed.length} dans nos thèmes, ${withImg} avec image`);
    console.log(`   ex. « ${themed[0]?.title ?? fresh[0]?.title ?? items[0]?.title} »`);
  } catch (e) {
    console.log(`✘ ${s.name}: ${String(e).slice(0, 160)}`);
  }
}
