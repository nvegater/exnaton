"use client";

import { useState, useMemo } from "react";
import { api } from "exnaton/trpc/react";
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
import { format } from "date-fns";

type Intervals = "hourly" | "daily" | "weekly" | "monthly";

const MUID_COLORS = {
  "95ce3367-cbce-4a4d-bbe3-da082831d7bd": "#8884d8",
  "1db7649e-9342-4e04-97c7-f0ebb88ed1f8": "#82ca9d",
};

interface Measurement {
  muid: string;
  time: string;
  value: number;
}

type GroupedData = Record<string, Measurement[]>;

interface MuidData {
  muid: string;
  data: Measurement[];
}

export const ExploreData = () => {
  const [selectedInterval, setSelectedInterval] = useState<Intervals>("hourly");
  const [showAverage, setShowAverage] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
  } = api.measurements.getAllMeasurements.useInfiniteQuery(
    {
      limit: 50,
      interval: selectedInterval,
      withAverage: showAverage,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const muidData = useMemo<MuidData[]>(() => {
    const groupedData = (
      data?.pages.flatMap((page) => page.chartData) ?? []
    ).reduce<GroupedData>((acc, measurement) => {
      if (!acc[measurement.muid]) {
        acc[measurement.muid] = [];
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      acc[measurement.muid].push(measurement);
      return acc;
    }, {});

    return Object.entries(groupedData).map(
      ([muid, data]): MuidData => ({
        muid,
        data: data.sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        ),
      }),
    );
  }, [data]);

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

  const toggleAverage = () => {
    setShowAverage((prev) => !prev);
    void refetch();
  };

  if (status === "pending") return <div>Loading...</div>;
  if (status === "error") return <div>An error occurred</div>;

  return (
    <div>
      <h2>Data Exploration</h2>
      <select
        value={selectedInterval}
        onChange={(e) => setSelectedInterval(e.target.value as Intervals)}
      >
        <option value="hourly">Hourly</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <label>
        <input type="checkbox" checked={showAverage} onChange={toggleAverage} />
        Show Average
      </label>
      {muidData.map(({ muid, data }) => (
        <div key={muid} style={{ marginBottom: "40px" }}>
          <h3>MUID: {muid}</h3>
          <div style={{ width: "1200px", height: 400 }}>
            <ResponsiveContainer>
              <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(time: string) =>
                    format(new Date(time), "HH:mm")
                  }
                />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip
                  labelFormatter={(label: string) =>
                    formatDate(new Date(label))
                  }
                  formatter={(value: number) => [value.toFixed(4), "Value"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={muid.slice(0, 8)}
                  stroke={MUID_COLORS[muid as keyof typeof MUID_COLORS]}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map((measurement) => (
                  <tr key={measurement.time}>
                    <td>{formatDate(new Date(measurement.time))}</td>
                    <td>{measurement.value.toFixed(8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {hasNextPage && (
        <button onClick={loadMore} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading more..." : "Load More"}
        </button>
      )}
    </div>
  );
};
