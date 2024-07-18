"use client";

import { useState } from "react";

import { api, type RouterOutputs } from "exnaton/trpc/react";
import { Button } from "exnaton/components/ui/button";
import { TRPCError } from "@trpc/server";

type ImportedMeasurement =
  RouterOutputs["measurements"]["importData"]["latestMeasurement"];

export function SeedDB() {
  const [latestMeasurement] = api.measurements.getLatest.useSuspenseQuery();

  const { mutateAsync: importData, isPending } =
    api.measurements.importData.useMutation();
  const [latestInsertedMeasurement, setLatestInsertedMeasurement] =
    useState<ImportedMeasurement | null>(null);

  // const utils = api.useUtils();
  // const [name, setName] = useState("");
  // const createPost = api.post.create.useMutation({
  //   onSuccess: async () => {
  //     await utils.post.invalidate();
  //     setName("");
  //   },
  // });

  return (
    <div className="w-full max-w-xs">
      {latestInsertedMeasurement ? (
        <p className="truncate">
          Your most recent measurement from:{" "}
          {latestInsertedMeasurement.timestamp.toDateString()}
        </p>
      ) : null}
      {latestMeasurement ? (
        <p className="truncate">
          Your most recent measurement from:{" "}
          {latestMeasurement.timestamp.toDateString()}
        </p>
      ) : (
        <div>
          <p>You have no Measurements yet. Import Data to DB to start</p>
          <Button
            onClick={async () => {
              try {
                const result = await importData();
                alert(`Imported ${result.insertedCount} measurements`);
                setLatestInsertedMeasurement(result.latestMeasurement);
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
      {/* <form
        onSubmit={(e) => {
          e.preventDefault();
          createPost.mutate({ name });
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          placeholder="Title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-full px-4 py-2 text-black"
        />
        <button
          type="submit"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
          disabled={createPost.isPending}
        >
          {createPost.isPending ? "Submitting..." : "Submit"}
        </button>
      </form> */}
    </div>
  );
}
