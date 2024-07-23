"use client";

import { useState } from "react";

import { api, type RouterOutputs } from "exnaton/trpc/react";
import { Button } from "exnaton/components/ui/button";
import { TRPCError } from "@trpc/server";

type ImportedMeasurement =
  RouterOutputs["measurements"]["importData"]["latestMeasurement"];

export function SeedDB() {
  const { mutateAsync: importData, isPending } =
    api.measurements.importData.useMutation();

  const { data: latestMeasurement, refetch: refetchLatestMeasurement } =
    api.measurements.getLatest.useQuery();

  return (
    <div className="w-full max-w-xs">
      {latestMeasurement ? (
        <p >
          Measurements are available, latest: <br/>
          {latestMeasurement.timestamp.toISOString()}
        </p>
      ) : (
        <div>
          <p>You have no Measurements yet. Import Data to DB to start</p>
          <Button
            onClick={async () => {
              try {
                const result = await importData();
                alert(`Imported ${result.insertedCount} measurements`);
                await refetchLatestMeasurement();
              } catch (error) {
                if (error instanceof TRPCError) {
                  alert(error.message);
                } else {
                  alert("An error occurred importing Data");
                }
                console.error(error);
              }
            }}
            disabled={isPending}
          >
            Start import
          </Button>
          {isPending ? <p>Importing...</p> : null}
        </div>
      )}
    </div>
  );
}
