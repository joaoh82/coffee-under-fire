import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { nicknameSchema } from "../../../packages/shared/leaderboard";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
export class NameRejected extends Error {
  constructor() {
    super(
      "Choose another name: use 1–40 visible characters, without profanity or sexual content.",
    );
  }
}
export function publicName(raw: unknown): string {
  const parsed = nicknameSchema.safeParse(raw);
  if (!parsed.success) throw new NameRejected();
  const name = parsed.data;
  // Additional adult-content terms beyond the English profanity preset.
  const compact = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(
      /[013457@$]/g,
      (c) =>
        ({
          "0": "o",
          "1": "i",
          "3": "e",
          "4": "a",
          "5": "s",
          "7": "t",
          "@": "a",
          $: "s",
        })[c]!,
    )
    .replace(/[^a-z]/g, "");
  if (
    matcher.hasMatch(name) ||
    matcher.hasMatch(compact) ||
    (/sex/.test(compact) &&
      !["sexton", "essex", "sussex", "middlesex"].includes(compact)) ||
    /porn|hentai|xxx|nsfw|nudes?|naked|erotic|onlyfans|sexting|sexual/.test(
      compact,
    )
  )
    throw new NameRejected();
  return name;
}
