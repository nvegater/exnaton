// import { LatestPost } from "exnaton/app/_components/post";
import { HydrateClient } from "exnaton/trpc/server";
import { SeedDB } from "./_components/SeedDB";
import { ExploreData } from "./_components/ExploreData";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-8xl my-8">Coding Challenge: Exnaton</h1>
        <h2 className="text-4xl my-4">Task 1: Import Data Dumps to DB.</h2>
        <SeedDB />
        <h2 className="text-4xl my-4">Task 2: explore the Data.</h2>
        <ExploreData />
      </main>
    </HydrateClient>
  );
}
