"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Button, buttonVariants } from "exnaton/components/ui/button";
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
import { cn } from "exnaton/components/lib/utils";

const MUID_COLORS = {
  "95ce3367-cbce-4a4d-bbe3-da082831d7bd": "#8884d8",
  "1db7649e-9342-4e04-97c7-f0ebb88ed1f8": "#82ca9d",
};

const MUID_OPTIONS = Object.keys(MUID_COLORS);
const TIME_STEP_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

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
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedMuid, setSelectedMuid] = useState<string>(
    "95ce3367-cbce-4a4d-bbe3-da082831d7bd",
  );
  const [timeStep, setTimeStep] = useState<number>(15);

  const { data: timeInterval } = api.measurements.getTimeInterval.useQuery();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.measurements.getAllMeasurements.useInfiniteQuery(
      {
        muiId: selectedMuid,
        limit: 50,
        startInterval: startDate,
        endInterval: endDate,
        timeStep: timeStep,
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

  return (
    <div>
      <div id="filters-container" className="flex justify-evenly items-center">
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

        <Select
          value={timeStep.toString()}
          onValueChange={(value) => setTimeStep(Number(value))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Time Step" />
          </SelectTrigger>
          <SelectContent>
            {TIME_STEP_OPTIONS.map((step) => (
              <SelectItem key={step} value={step.toString()}>
                {step} minutes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger>
            <div className={cn(buttonVariants({ variant: "outline" }))}>
              {startDate ? format(startDate, "PPP") : "Start Date"}
            </div>
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
            <div className={cn(buttonVariants({ variant: "outline" }))}>
              {endDate ? format(endDate, "PPP") : "End Date"}
            </div>
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
      </div>

      <div
        id="charts-container"
        className="flex flex-col items-center w-full px-4 sm:px-6 lg:px-8"
      >
        {muidData.map(({ muid, data }, index) => (
          <div key={`mui-${index}`} className="w-full max-w-7xl mb-10">
            <h3 className="text-lg font-semibold mb-4">MUID: {muid}</h3>
            <div className="w-full h-[300px] sm:h-[400px] lg:h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
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
            <div className="flex justify-center my-6">
              <Button
                onClick={loadMore}
                disabled={isFetchingNextPage || !hasNextPage}
                variant={isFetchingNextPage ? "secondary" : "default"}
                size="lg"
              >
                {!hasNextPage
                  ? "No more data"
                  : isFetchingNextPage
                    ? "Loading more..."
                    : "Load More data"}
              </Button>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">Time</th>
                    <th className="px-4 py-2 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((measurement, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">
                        {formatDate(new Date(measurement.time))}
                      </td>
                      <td className="px-4 py-2">
                        {measurement.value.toFixed(8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
