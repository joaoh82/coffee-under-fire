import { z } from "zod";
export const boardOptionsSchema = z
  .object({
    mapId: z.enum(["woodland.v1", "village.v1"]),
    difficulty: z.enum(["easy.v1", "normal.v1", "hard.v1"]),
    missionMode: z.enum(["mission", "endless"]),
  })
  .strict();
export type BoardOptions = z.infer<typeof boardOptionsSchema>;
export const DEFAULT_BOARD: BoardOptions = {
  mapId: "woodland.v1",
  difficulty: "normal.v1",
  missionMode: "mission",
};
export const scoreReportSchema = z
  .object({
    score: z.number().finite().min(0).max(2_000_000),
    time: z.number().finite().min(5).max(1800),
    kills: z.number().int().min(0).max(36000),
    deliveries: z.number().int().min(0).max(1500),
    level: z.number().int().min(1).max(500),
    won: z.boolean(),
  })
  .strict();
export type ScoreReport = z.infer<typeof scoreReportSchema>;
export const nicknameSchema = z
  .string()
  .trim()
  .normalize()
  .min(1)
  .max(40)
  .regex(
    /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u,
    "Use visible characters without line breaks or hidden formatting.",
  )
  .refine((name) => !/[<>]/.test(name), "HTML is not allowed.");
export const scoreSubmissionSchema = z
  .object({ name: nicknameSchema, report: scoreReportSchema })
  .strict();
export function reportPoints(data: { score: number; time: number }) {
  return Math.round(data.score + data.time);
}
export type BoardEntry = {
  id: string;
  name: string;
  score: number;
  time: number;
  kills: number;
  deliveries: number;
  created: number;
};
