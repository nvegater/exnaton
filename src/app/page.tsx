// import { LatestPost } from "exnaton/app/_components/post";
import { HydrateClient } from "exnaton/trpc/server";
import { SeedDB } from "./_components/SeedDB";
import { ExploreData } from "./_components/ExploreData";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-8xl my-8">Coding Challenge: Exnaton</h1>
        <h2 className="text-4xl my-4">Task A: Data exploration.</h2>
        <div className="p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">
            Energy Measurement Data Analysis
          </h2>

          <section className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              Data Structure
            </h3>
            <ul className="list-disc pl-6 text-gray-700">
              <li>
                Two separate files, each with a unique MUID (Meter Unique
                Identifier)
              </li>
              <li>
                Data points contain timestamp, energy measurement value, and
                identifying information
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              Data Characteristics
            </h3>
            <ul className="list-disc pl-6 text-gray-700">
              <li>
                {
                  'All measurements are for "energy" with "measured" quality tag'
                }
              </li>
              <li>2688 data points per meter</li>
              <li>15-minute interval timestamps</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              Meter Identification
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white p-3 rounded shadow">
                <p className="font-medium">First dataset:</p>
                <p>MUID: 95ce3367-cbce-4a4d-bbe3-da082831d7bd</p>
                <p>Meter: 0100011D00FF</p>
              </div>
              <div className="bg-white p-3 rounded shadow">
                <p className="font-medium">Second dataset:</p>
                <p>MUID: 1db7649e-9342-4e04-97c7-f0ebb88ed1f8</p>
                <p>Meter: 0100021D00FF</p>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              Hypothesis
            </h3>
            <p className="text-gray-700 mb-2">
              This appears to be smart meter data for electrical energy
              consumption, likely representing:
            </p>
            <ul className="list-disc pl-6 text-gray-700">
              <li>Residential or commercial energy usage</li>
              <li>Individual properties or metering points (MUIDs)</li>
              <li>Physical smart meters (meter addresses)</li>
              <li>Energy values probably in kilowatt-hours (kWh)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              Common Uses
            </h3>
            <ul className="list-disc pl-6 text-gray-700">
              <li>Billing purposes</li>
              <li>Energy consumption analysis</li>
              <li>Load forecasting</li>
              <li>Identifying usage patterns or anomalies</li>
            </ul>
          </section>
        </div>
        <h2 className="text-4xl my-4">Task B: Backend.</h2>
        <SeedDB />
        <div className="max-w-3xl mx-auto p-4">
          <h2 className="text-2xl font-bold mb-4">Backend System Summary</h2>

          <h3 className="text-xl font-semibold mt-4 mb-2">
            Task B1: Data Retrieval and Storage
          </h3>
          <p className="mb-4">
            The backend implements a data retrieval and storage system using
            tRPC. The <code>importData</code> procedure in the{" "}
            <code>measurementsRouter</code> handles this task:
          </p>
          <ul className="list-disc pl-5 mt-2">
            <li>
              It fetches data from two predefined URLs using the{" "}
              <code>fetchJsonDataAndParse</code> function.
            </li>
            <li>
              The retrieved data is parsed and validated using Zod schemas,
              ensuring data integrity.
            </li>
            <li>
              Parsed measurements are then mapped to a format suitable for
              database insertion.
            </li>
            <li>
              The data is stored in the database using the{" "}
              <code>energyMeasurements</code> table schema.
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">
            Task B2: Data Access Endpoint
          </h3>
          <p className="mb-4">
            The backend provides a flexible endpoint for frontend data access
            through the <code>getAllMeasurements</code> procedure:
          </p>
          <ul className="list-disc pl-5 mt-2">
            <li>
              It supports pagination using a cursor-based approach, allowing
              efficient data loading.
            </li>
            <li>
              Query parameters include <code>limit</code>, <code>cursor</code>,{" "}
              <code>startInterval</code>, and <code>endInterval</code>.
            </li>
            <li>
              These parameters enable the frontend to request specific data
              ranges and control the amount of data fetched.
            </li>
            <li>
              The endpoint returns structured data including chart-ready
              measurements and a next cursor for pagination.
            </li>
          </ul>
          <p className="mb-4">Additional utility endpoints are provided:</p>
          <ul className="list-disc pl-5 mt-2">
            <li>
              <code>getTimeInterval</code>: Returns the min and max timestamps
              in the dataset.
            </li>
            <li>
              <code>getLatest</code>: Retrieves the most recent measurement.
            </li>
          </ul>

          <p className="mb-4">
            By utilizing tRPC, the backend achieves type-safe API development,
            reducing errors and improving developer experience. This approach
            also allows for easy exposure of endpoints as REST APIs using
            OpenAPI converters if needed in the future.
          </p>
        </div>
        <h2 className="text-4xl my-4">Task C: Frontend.</h2>
        <div className="max-w-3xl mx-auto p-4">
          <h2 className="text-2xl font-bold mb-4">Frontend System Summary</h2>

          <h3 className="text-xl font-semibold mt-4 mb-2">
            Task C1: Frontend Application
          </h3>
          <p className="mb-4">
            The frontend is built using React and the T3 stack, which includes
            Next.js for server-side rendering and routing.
          </p>
          <h3 className="text-xl font-semibold mt-4 mb-2">
            Task C2: Data Loading
          </h3>
          <p className="mb-4">
            The application uses tRPC&apos;s React hooks to load data from the
            backend:
          </p>
          <ul className="list-disc pl-5 mt-2">
            <li>
              The <code>useInfiniteQuery</code> hook is used to fetch paginated
              data from the <code>getAllMeasurements</code> endpoint.
            </li>
            <li>
              It supports dynamic loading of more data as the user scrolls or
              requests it.
            </li>
            <li>
              Date range selection is implemented using the{" "}
              <code>startInterval</code> and <code>endInterval</code>{" "}
              parameters.
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-4 mb-2">
            Task C3: Data Visualization
          </h3>
          <p className="mb-4">
            Time-series data visualization is achieved using the Recharts
            library:
          </p>
          <ul className="list-disc pl-5 mt-2">
            <li>
              A <code>LineChart</code> component is used to display measurements
              over time for each MUID.
            </li>
            <li>
              The chart includes features like tooltips, legends, and responsive
              sizing.
            </li>
            <li>
              Data is preprocessed and grouped by MUID for efficient rendering.
            </li>
            <li>
              A tabular view of the data is also provided for detailed
              inspection.
            </li>
          </ul>
          <p className="mb-4">
            {"The frontend improves user experience with interactive elements like" +
              'date pickers for range selection and a "Load More" button for' +
              "pagination. It effectively visualizes the time-series data while" +
              "providing tools for data exploration and analysis"}
          </p>
        </div>

        <ExploreData />
      </main>
    </HydrateClient>
  );
}
