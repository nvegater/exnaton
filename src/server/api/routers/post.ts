import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "exnaton/server/api/trpc";
import {
  energyMeasurements,
  type InsertMeasurement,
  posts,
} from "exnaton/server/db/schema";
import { TRPCError } from "@trpc/server";

const rawMeasurementSchema = z.object({
  measurement: z.string(),
  timestamp: z.string().datetime(),
  tags: z.object({
    muid: z.string(),
    quality: z.string(),
  }),
  "0100011D00FF": z.number().optional(),
  "0100021D00FF": z.number().optional(),
});
type RawMeasurement = z.infer<typeof rawMeasurementSchema>;

const mapMeasurementsToInsertParams = (
  measurements: RawMeasurement[],
): InsertMeasurement[] => {
  return measurements.map((measurement) => {
    const meterAddress =
      measurement["0100011D00FF"] !== undefined
        ? "0100011D00FF"
        : "0100021D00FF";
    const valueAsString = measurement[meterAddress as keyof RawMeasurement];
    if (typeof valueAsString !== "string")
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Value is not a number",
      });

    return {
      timestamp: new Date(measurement.timestamp),
      muid: measurement.tags.muid,
      meterAddress,
      value: valueAsString,
    };
  });
};

const fetchJsonDataAndParse = async (): Promise<RawMeasurement[]> => {
  const urls = [
    "https://exnaton-public-s3-bucket20230329123331528000000001.s3.eu-central-1.amazonaws.com/challenge/95ce3367-cbce-4a4d-bbe3-da082831d7bd.json",
    "https://exnaton-public-s3-bucket20230329123331528000000001.s3.eu-central-1.amazonaws.com/challenge/1db7649e-9342-4e04-97c7-f0ebb88ed1f8.json",
  ];

  const fetches = urls.map((url) =>
    fetch(url).then((response) => response.json()),
  );
  const rawDataArray = await Promise.all(fetches);

  const rawMeasurements: RawMeasurement[] = [];

  rawDataArray.forEach((rawData) => {
    if (
      !rawData ||
      typeof rawData !== "object" ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !Array.isArray(rawData.data)
    ) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid data structure in response",
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    rawData?.data?.forEach((data: unknown) => {
      const parsed = rawMeasurementSchema.parse(data);
      rawMeasurements.push(parsed);
    });
  });

  return rawMeasurements;
};

export const measurementsRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  importData: publicProcedure.mutation(async ({ ctx }) => {
    const measurement = await ctx.db.query.energyMeasurements.findFirst();
    if (measurement)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Data already imported",
      });

    const rawMeasurements = await fetchJsonDataAndParse();
    const insertParams = mapMeasurementsToInsertParams(rawMeasurements);

    const insertedValues = await ctx.db
      .insert(energyMeasurements)
      .values(insertParams)
      .returning();

    const insertedCount = insertedValues.length;

    const latestMeasurement = await ctx.db.query.energyMeasurements.findFirst({
      orderBy: (energyMeasurements, { desc }) => [
        desc(energyMeasurements.timestamp),
      ],
    });

    return { insertedValues, insertedCount, latestMeasurement };
  }),
  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // simulate a slow db call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await ctx.db.insert(posts).values({
        name: input.name,
      });
    }),

  getLatest: publicProcedure.query(async ({ ctx }) => {
    const latestMeasurement = await ctx.db.query.energyMeasurements.findFirst({
      orderBy: (energyMeasurements, { desc }) => [
        desc(energyMeasurements.timestamp),
      ],
    });

    if (!latestMeasurement) return null;
    return latestMeasurement;
  }),
});
