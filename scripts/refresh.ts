import { allFeeds, allSeries } from "../src/lib/catalog";
import { persistCatalogDefinitions, persistObservations } from "../src/lib/data/engine";
import { fetchNewsFeed, fetchSeries } from "../src/lib/data/providers";
import type { SeriesResult } from "../src/lib/types";

async function main() {
  await persistCatalogDefinitions();
  const results: SeriesResult[] = [];
  for (const config of allSeries()) {
    try {
      const result = await fetchSeries(config, true);
      results.push({
        config,
        observations: result.observations,
        stats: {},
        citation: result.citation,
        confidence: result.observations.length ? "high" : "unavailable"
      });
      console.log(`series ${config.id}: ${result.observations.length}`);
    } catch (error) {
      console.error(`series ${config.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await persistObservations(results);
  for (const feed of allFeeds()) {
    const items = await fetchNewsFeed(feed, true);
    console.log(`feed ${feed.id}: ${items.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
