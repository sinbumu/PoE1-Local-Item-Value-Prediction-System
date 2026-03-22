import { AuthService } from "../services/auth.service";
import { PoeApiService, formatAxiosError } from "../services/poe-api.service";
import type { PublicStashResponse } from "../types/poe.types";
import { logger } from "../utils/logger";
import { sleep } from "../utils/time";

type SeenLeagueRecord = {
  firstSeenAt: string;
  firstSeenPage: number;
  count: number;
};

function parseMinutesArgument(): number {
  const argument = process.argv.find((value) => value.startsWith("--minutes="));
  const value = argument?.split("=")[1];
  const minutes = value ? Number(value) : 10;

  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("Invalid --minutes value. Example: --minutes=10");
  }

  return minutes;
}

function parseStartLatestArgument(): boolean {
  return process.argv.includes("--start-latest");
}

function incrementCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function registerFirstSeen(
  registry: Record<string, SeenLeagueRecord>,
  key: string,
  page: number,
  kind: "stash" | "item",
): void {
  if (registry[key]) {
    registry[key].count += 1;
    return;
  }

  registry[key] = {
    firstSeenAt: new Date().toISOString(),
    firstSeenPage: page,
    count: 1,
  };

  logger.info(
    {
      league: key,
      page,
      kind,
    },
    "Observed new league value",
  );

  if (key === "Mirage") {
    logger.warn(
      {
        league: key,
        page,
        kind,
      },
      "Observed Mirage league value",
    );
  }
}

function observeResponse(
  response: PublicStashResponse,
  page: number,
  aggregateStashLeagues: Record<string, number>,
  aggregateItemLeagues: Record<string, number>,
  seenStashLeagues: Record<string, SeenLeagueRecord>,
  seenItemLeagues: Record<string, SeenLeagueRecord>,
): {
  stashLeagueCounts: Record<string, number>;
  itemLeagueCounts: Record<string, number>;
  stashCount: number;
  itemCount: number;
} {
  const stashLeagueCounts: Record<string, number> = {};
  const itemLeagueCounts: Record<string, number> = {};
  let itemCount = 0;

  for (const stash of response.stashes) {
    const stashLeague = stash.league ?? "(null)";
    incrementCount(aggregateStashLeagues, stashLeague);
    incrementCount(stashLeagueCounts, stashLeague);
    registerFirstSeen(seenStashLeagues, stashLeague, page, "stash");

    for (const item of stash.items) {
      const itemLeague =
        typeof item.league === "string" && item.league.length > 0
          ? item.league
          : "(null)";

      itemCount += 1;
      incrementCount(aggregateItemLeagues, itemLeague);
      incrementCount(itemLeagueCounts, itemLeague);
      registerFirstSeen(seenItemLeagues, itemLeague, page, "item");
    }
  }

  return {
    stashLeagueCounts,
    itemLeagueCounts,
    stashCount: response.stashes.length,
    itemCount,
  };
}

async function main(): Promise<void> {
  const minutes = parseMinutesArgument();
  const startLatest = parseStartLatestArgument();
  const durationMs = minutes * 60 * 1000;
  const startedAt = Date.now();
  const endsAt = startedAt + durationMs;

  const authService = new AuthService();
  const poeApiService = new PoeApiService();
  const accessToken = await authService.getAccessToken();

  let nextChangeId: string | undefined = startLatest
    ? await poeApiService.getLatestPublicStashChangeId()
    : undefined;
  let page = 0;
  let totalStashes = 0;
  let totalItems = 0;
  let emptyPages = 0;
  let mirageStashes = 0;
  let mirageItems = 0;

  const aggregateStashLeagues: Record<string, number> = {};
  const aggregateItemLeagues: Record<string, number> = {};
  const seenStashLeagues: Record<string, SeenLeagueRecord> = {};
  const seenItemLeagues: Record<string, SeenLeagueRecord> = {};

  logger.info(
    {
      minutes,
      endsAt: new Date(endsAt).toISOString(),
      startLatest,
      initialNextChangeId: nextChangeId ?? null,
    },
    "Starting league observation run",
  );

  while (Date.now() < endsAt) {
    page += 1;

    try {
      const response = await poeApiService.getPublicStashes(accessToken, nextChangeId);
      const observation = observeResponse(
        response,
        page,
        aggregateStashLeagues,
        aggregateItemLeagues,
        seenStashLeagues,
        seenItemLeagues,
      );

      totalStashes += observation.stashCount;
      totalItems += observation.itemCount;
      const pageMirageStashes =
        observation.stashLeagueCounts.Mirage ?? 0;
      const pageMirageItems = observation.itemLeagueCounts.Mirage ?? 0;
      mirageStashes += pageMirageStashes;
      mirageItems += pageMirageItems;

      logger.info(
        {
          page,
          requestedChangeId: nextChangeId ?? null,
          responseNextChangeId: response.next_change_id,
          stashCount: observation.stashCount,
          itemCount: observation.itemCount,
          mirageStashes: pageMirageStashes,
          mirageItems: pageMirageItems,
          topStashLeagues: Object.entries(observation.stashLeagueCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5),
          topItemLeagues: Object.entries(observation.itemLeagueCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5),
        },
        "Processed observation page",
      );

      if (pageMirageStashes > 0 || pageMirageItems > 0) {
        logger.warn(
          {
            page,
            requestedChangeId: nextChangeId ?? null,
            responseNextChangeId: response.next_change_id,
            mirageStashes: pageMirageStashes,
            mirageItems: pageMirageItems,
          },
          "Mirage data detected in observation stream",
        );
      }

      if (observation.stashCount === 0) {
        emptyPages += 1;
        await sleep(5000);
      }

      nextChangeId = response.next_change_id;
    } catch (error) {
      logger.error(
        {
          page,
          error: formatAxiosError(error),
        },
        "League observation request failed",
      );

      await sleep(5000);
    }
  }

  const summary = {
    minutes,
    startLatest,
    pagesChecked: page,
    emptyPages,
    totalStashes,
    totalItems,
    mirageStashes,
    mirageItems,
    finalNextChangeId: nextChangeId ?? null,
    observedStashLeagues: seenStashLeagues,
    observedItemLeagues: seenItemLeagues,
    aggregateTopStashLeagues: Object.entries(aggregateStashLeagues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
    aggregateTopItemLeagues: Object.entries(aggregateItemLeagues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
  };

  logger.info(summary, "League observation run finished");
  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    "League observation script failed",
  );

  process.exitCode = 1;
});
