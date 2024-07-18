// import { LatestPost } from "exnaton/app/_components/post";
import { Button } from "exnaton/components/ui/button";
import { HydrateClient } from "exnaton/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-8xl my-8">Coding Challenge: Exnaton</h1>
        <h2 className="text-4xl my-4">Task 1: Import Data Dumps to DB.</h2>
        <p>
          This button will retrieve the JSON dumps and import them to the DB.
          The structure of the Data was already Analyzed
        </p>
        <Button className="text-white">Start Import</Button>
      </main>
    </HydrateClient>
  );
}
