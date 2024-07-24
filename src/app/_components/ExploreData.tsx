"use client";

import { useState, useMemo, useEffect, useId } from "react";
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
import { Button } from "exnaton/components/ui/button";
import { Calendar } from "exnaton/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "exnaton/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "exnaton/components/ui/select";

const MUID_COLORS = {
  "95ce3367-cbce-4a4d-bbe3-da082831d7bd": "#8884d8",
  "1db7649e-9342-4e04-97c7-f0ebb88ed1f8": "#82ca9d",
};

const MUID_OPTIONS = Object.keys(MUID_COLORS);

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
  const reactID = useId();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedMuid, setSelectedMuid] = useState<string>(
    "95ce3367-cbce-4a4d-bbe3-da082831d7bd",
  );

  const { data: timeInterval } = api.measurements.getTimeInterval.useQuery();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    api.measurements.getAllMeasurements.useInfiniteQuery(
      {
        muiId: selectedMuid,
        limit: 50,
        startInterval: startDate,
        endInterval: endDate,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );

  const [minDate, setMinDate] = useState<Date | undefined>(undefined);
  const [maxDate, setMaxDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (timeInterval) {
      const min = new Date(timeInterval.min);
      const max = new Date(timeInterval.max);
      setMinDate(min);
      setMaxDate(max);
      setStartDate(min);
      setEndDate(max);
    }
  }, [timeInterval]);

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

  const formatDate = (d: Date) => {
    const dateString = format(d, "MMM d");
    const timeString = format(d, "HH:mm");
    return `${timeString} (${dateString})`;
  };

  if (status === "pending") return <div>Loading...</div>;
  if (status === "error") return <div>An error occurred</div>;

  console.log("Has next page?", hasNextPage);

  return (
    <div>
      <Select value={selectedMuid} onValueChange={setSelectedMuid}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select MUID" />
        </SelectTrigger>
        <SelectContent>
          {MUID_OPTIONS.map((muid) => (
            <SelectItem key={muid} value={muid}>
              {muid.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasNextPage && (
        <Button onClick={loadMore} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading more..." : "Load More"}
        </Button>
      )}
      <Popover>
        <PopoverTrigger>
          <Button variant="outline">
            {startDate ? format(startDate, "PPP") : "Start Date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={setStartDate}
            initialFocus
            disabled={(date) => date < minDate! || date > maxDate!}
            defaultMonth={minDate}
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            {endDate ? format(endDate, "PPP") : "End Date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={endDate}
            onSelect={setEndDate}
            initialFocus
            disabled={(date) => date < minDate! || date > maxDate!}
            defaultMonth={maxDate}
          />
        </PopoverContent>
      </Popover>

      {muidData.map(({ muid, data }, index) => (
        <div key={`mui-${index}`} style={{ marginBottom: "40px" }}>
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
                {data.map((measurement, index) => (
                  <tr key={index}>
                    <td>{formatDate(new Date(measurement.time))}</td>
                    <td>{measurement.value.toFixed(8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
