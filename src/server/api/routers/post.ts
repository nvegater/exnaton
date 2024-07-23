import {z} from "zod";

import {createTRPCRouter, publicProcedure} from "exnaton/server/api/trpc";
import {energyMeasurements, type InsertMeasurement, posts,} from "exnaton/server/db/schema";
import {TRPCError} from "@trpc/server";
import {asc, gt, sql} from "drizzle-orm";

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
            const parsed = rawMeasurementSchema.parse(data);
            rawMeasurements.push(parsed);
        });
    });

    return rawMeasurements;
};

export const measurementsRouter = createTRPCRouter({
    getAllMeasurements: publicProcedure
        .input(
            z.object({
                withAverage: z.boolean().default(false),
                limit: z.number().min(1).max(100).optional().default(50),
                cursor: z.number().optional(),
                interval: z
                    .enum(["hourly", "daily", "weekly", "monthly"])
                    .default("hourly"),
            }),
        )
        .query(async ({ctx, input}) => {
            const {limit, cursor, interval, withAverage} = input;

            if (withAverage) {
                const getIntervalStart = (interval: string) => {
                    switch (interval) {
                        case 'hourly':
                            return sql`date_trunc('hour', ${energyMeasurements.timestamp})`;
                        case 'daily':
                            return sql`date_trunc('day', ${energyMeasurements.timestamp})`;
                        case 'weekly':
                            return sql`date_trunc('week', ${energyMeasurements.timestamp})`;
                        case 'monthly':
                            return sql`date_trunc('month', ${energyMeasurements.timestamp})`;
                        default:
                            return sql`date_trunc('hour', ${energyMeasurements.timestamp})`;
                    }
                };

                const intervalStart = getIntervalStart(interval);

                const results = await ctx.db
                    .select({
                        id: energyMeasurements.id,
                        intervalStart,
                        muid: energyMeasurements.muid,
                        avgValue: sql<number>`avg(${energyMeasurements.value})`,
                        count: sql<number>`count(*)`,
                    })
                    .from(energyMeasurements)
                    .where(cursor ? gt(energyMeasurements.id, cursor) : undefined)
                    .groupBy(intervalStart, energyMeasurements.id, energyMeasurements.muid)
                    .orderBy(asc(intervalStart), asc(energyMeasurements.id))
                    .limit(limit + 1);

                const mappedResults = results.map((result) => ({
                    ...result,
                    intervalStart: result.intervalStart as string
                }));

                // Prepare data for Recharts
                const chartData = mappedResults.map(m => ({
                    time: new Date(m.intervalStart).getTime(),
                    value: m.avgValue,
                    muid: m.muid
                })).sort((a, b) => a.time - b.time);

                let nextCursor: number | undefined = undefined;
                if (results.length > limit) {
                    const nextItem = results.pop();
                    nextCursor = nextItem!.id;
                }
                return {
                    chartData,
                    nextCursor,
                }
            }

            const results = await ctx.db
                .select({
                    id: energyMeasurements.id,
                    timestamp: energyMeasurements.timestamp,
                    muid: energyMeasurements.muid,
                    value: energyMeasurements.value,
                })
                .from(energyMeasurements)
                .where(cursor ? gt(energyMeasurements.id, cursor) : undefined)
                .orderBy(asc(energyMeasurements.timestamp), asc(energyMeasurements.id))
                .limit(limit + 1);

            let nextCursor: number | undefined = undefined;
            if (results.length > limit) {
                const nextItem = results.pop();
                nextCursor = nextItem!.id;
            }

            const chartData = results
                .map((m) => ({
                    time: m.timestamp.getTime(),
                    value: m.value,
                    muid: m.muid,
                }))
                .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());


            return {
                chartData,
                nextCursor,
            };
        }),
    hello: publicProcedure
        .input(z.object({text: z.string()}))
        .query(({input}) => {
            return {
                greeting: `Hello ${input.text}`,
            };
        }),

    importData: publicProcedure.mutation(async ({ctx}) => {
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
            orderBy: (energyMeasurements, {desc}) => [
                desc(energyMeasurements.timestamp),
            ],
        });

        return {insertedValues, insertedCount, latestMeasurement};
    }),
    create: publicProcedure
        .input(z.object({name: z.string().min(1)}))
        .mutation(async ({ctx, input}) => {
            // simulate a slow db call
            await new Promise((resolve) => setTimeout(resolve, 1000));

            await ctx.db.insert(posts).values({
                name: input.name,
            });
        }),

    getLatest: publicProcedure.query(async ({ctx}) => {
        const latestMeasurement = await ctx.db.query.energyMeasurements.findFirst({
            orderBy: (energyMeasurements, {desc}) => [
                desc(energyMeasurements.timestamp),
            ],
        });

        if (!latestMeasurement) return null;
        return latestMeasurement;
    }),
});
