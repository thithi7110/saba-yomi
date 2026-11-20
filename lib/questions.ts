import sortData from "@/data/sort.json";
import headlineData from "@/data/headline.json";
import type { HeadlineItem, SortCard, SortTopic } from "./types";

export const SORT_TOPICS: SortTopic[] = sortData.topics;
export const SORT_CARDS: SortCard[] = sortData.cards as SortCard[];
export const HEADLINE_ITEMS: HeadlineItem[] = headlineData.items;

export function topicById(id: string): SortTopic {
  const t = SORT_TOPICS.find((t) => t.id === id);
  if (!t) throw new Error(`unknown topic: ${id}`);
  return t;
}

/** 読む字数（空白を除く） */
export function countChars(text: string): number {
  return text.replace(/\s/g, "").length;
}
