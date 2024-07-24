import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "exnaton/server/api/trpc";
import {
  energyMeasurements,
  type InsertMeasurement,
} from "exnaton/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, gte, lte, sql } from "drizzle-orm";

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
    const valueAsString = measurement[meterAddress];
    if (valueAsString === undefined)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Value is not a number: ${valueAsString}`,
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
      // If the data has other shape we would throw an error here.
      const parsed = rawMeasurementSchema.parse(data);
      rawMeasurements.push(parsed);
    });
  });

  return rawMeasurements;
};

export const measurementsRouter = createTRPCRouter({
  getTimeInterval: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        min: sql<string>`MIN(${energyMeasurements.timestamp})::text`,
        max: sql<string>`MAX(${energyMeasurements.timestamp})::text`,
      })
      .from(energyMeasurements)
      .execute();

    const resultElement = result[0];
    if (!result.length || !resultElement?.min || !resultElement?.max) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No Time interval Found",
      });
    }

    return {
      min: new Date(resultElement.min).getTime(),
      max: new Date(resultElement.max).getTime(),
    };
  }),
  getAllMeasurements: publicProcedure
    .input(
      z.object({
        muiId: z.string().describe("Meter Unique Identifier"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .default(50)
          .describe("Maximum number of results to return (1-100, default: 50)"),
        cursor: z
          .number()
          .optional()
          .describe(
            "ID of the last item in the previous page, for pagination, for initial page leave empty",
          ),
        startInterval: z
          .date()
          .optional()
          .describe("Start date/time for filtering measurements"),
        endInterval: z
          .date()
          .optional()
          .describe("End date/time for filtering measurements"),
        timeStep: z
          .number()
          .min(15)
          .max(180)
          .default(15)
          .describe(
            "Time interval in minutes for grouping measurements (15-180, default: 15)",
          ),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, startInterval, endInterval, muiId, timeStep } =
        input;
      const query = ctx.db
        .select({
          id: energyMeasurements.id,
          timestamp: energyMeasurements.timestamp,
          muid: energyMeasurements.muid,
          value: energyMeasurements.value,
        })
        .from(energyMeasurements)
        .where(
          and(
            eq(energyMeasurements.muid, muiId),
            cursor ? gt(energyMeasurements.id, cursor) : undefined,
            startInterval
              ? gte(energyMeasurements.timestamp, startInterval)
              : undefined,
            endInterval
              ? lte(energyMeasurements.timestamp, endInterval)
              : undefined,
          ),
        )
        .orderBy(energyMeasurements.timestamp, energyMeasurements.id);

      const results = await query.execute();

      const roundToNearestInterval = (date: Date, intervalMinutes: number) => {
        const ms = 1000 * 60 * intervalMinutes;
        return new Date(Math.round(date.getTime() / ms) * ms);
      };

      // Filter results based on timeStep
      const filteredResults = results.reduce((acc: typeof results, curr) => {
        const roundedTimestamp = roundToNearestInterval(
          curr.timestamp,
          timeStep,
        );
        const existingIndex = acc.findIndex(
          (item) => item.timestamp.getTime() === roundedTimestamp.getTime(),
        );

        if (existingIndex === -1) {
          acc.push({ ...curr, timestamp: roundedTimestamp });
        } else {
          const resultElement = acc[existingIndex]!;
          if (!resultElement)
            throw new Error(
              "Unexpected error rounding time, undefined element.. weird",
            );
          if (curr.timestamp.getTime() > resultElement.timestamp.getTime()) {
            acc[existingIndex] = { ...curr, timestamp: roundedTimestamp };
          }
        }

        return acc;
      }, []);

      // Store the ID of the last result before filtering
      const lastResultId = results[results.length - 1]?.id;

      // Apply limit
      const limitedResults = filteredResults.slice(0, limit);

      // Set nextCursor based on the original results, not the filtered ones
      const nextCursor = results.length > limit ? lastResultId : undefined;

      const chartData = limitedResults.map((m) => ({
        time: m.timestamp.getTime(),
        value: m.value,
        muid: m.muid,
      }));

      return {
        chartData,
        nextCursor,
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
