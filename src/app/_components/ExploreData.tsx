"use client";

import {useState} from "react";
import {api} from "exnaton/trpc/react";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {format, parseISO} from "date-fns";

type Intervals = "hourly" | "daily" | "weekly" | "monthly";

export const ExploreData = () => {
    const [selectedInterval, setSelectedInterval] = useState<Intervals>("hourly");

    const {data, fetchNextPage, hasNextPage, isFetchingNextPage, status} =
        api.measurements.getAllMeasurements.useInfiniteQuery(
            {
                limit: 50,
                interval: selectedInterval,
                withAverage: false,
            },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        );

    const measurements = data?.pages.flatMap((page) => page.chartData) ?? [];

    const loadMore = async () => {
        if (hasNextPage) {
            await fetchNextPage();
        }
    };

    // Custom date formatter
    const formatDate = (d: Date) => {
        const dateString = format(d, "MMM d");
        const timeString = format(d, "HH:mm");
        return `${timeString} (${dateString})`;
    };


    if (status === "pending") return <div>Loading...</div>;
    if (status === "error") return <div>An error occurred</div>;

    return (
        <div>
            <h2>Data Exploration</h2>
            <select
                value={selectedInterval}
                onChange={(e) => {
                    if (e.target.value) return;
                    setSelectedInterval(e.target.value as Intervals);
                }}
            >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
            </select>
            <div style={{width: "1200px", height: 800}}>
                <ResponsiveContainer>
                    <LineChart
                        data={measurements}
                        margin={{top: 5, right: 30, left: 20, bottom: 5}}
                    >
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis
                            dataKey="time"
                            tickFormatter={(time: Date) => {
                                return format(time, "HH:mm")
                            }}
                        />
                        <YAxis/>
                        <Tooltip
                            labelFormatter={(label: string) => formatDate(new Date(label))}
                            formatter={(value: number) => [value.toFixed(4), "Value"]}
                        />
                        <Legend/>
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#8884d8"
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div>
                {measurements.map((measurement) => (
                    <div key={measurement.time}>
                        <h3>{measurement.time}</h3>
                        <p>MUID: {measurement.muid}</p>
                        <p>Value: {measurement.value.toFixed(8)}</p>
                    </div>
                ))}
            </div>
            {hasNextPage && (
                <button onClick={loadMore} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? "Loading more..." : "Load More"}
                </button>
            )}
        </div>
    );
};
