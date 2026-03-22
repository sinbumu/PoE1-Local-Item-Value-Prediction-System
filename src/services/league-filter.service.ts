import { env } from "../config/env";
import type {
  PublicItem,
  PublicStashChange,
  PublicStashResponse,
} from "../types/poe.types";

export class LeagueFilterService {
  private readonly targetLeague = env.TARGET_LEAGUE;

  isTargetLeague(league?: string | null): boolean {
    if (!this.targetLeague) {
      return true;
    }

    return league === this.targetLeague;
  }

  filterResponse(response: PublicStashResponse): PublicStashResponse {
    const stashes = response.stashes
      .map((stashChange) => this.filterStashChange(stashChange))
      .filter((stashChange): stashChange is PublicStashChange => stashChange !== null);

    return {
      next_change_id: response.next_change_id,
      stashes,
    };
  }

  private filterStashChange(stashChange: PublicStashChange): PublicStashChange | null {
    const filteredItems = stashChange.items.filter((item) => this.isTargetItem(item));
    const matchesStashLeague = this.isTargetLeague(stashChange.league);

    if (!matchesStashLeague && filteredItems.length === 0) {
      return null;
    }

    return {
      ...stashChange,
      items: filteredItems,
    };
  }

  private isTargetItem(item: PublicItem): boolean {
    const itemLeague =
      typeof item.league === "string" ? item.league : undefined;

    return this.isTargetLeague(itemLeague);
  }
}
