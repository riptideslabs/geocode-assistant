import { createVertex } from "@ai-sdk/google-vertex";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
  tool,
} from "ai";
import { z } from "zod";

type StateResult = {
  state: "started" | "completed" | "error";
};

type TokenResult = {
  token: string;
};

type LocationResult = {
  location: {
    latitude: number;
    longitude: number;
  };
};

type FormattedAddressResult = {
  formattedAddress: string;
};

export type AddressToCoordsResult = StateResult & Partial<TokenResult & LocationResult>;

export type CoordsToAddressResult = StateResult & Partial<TokenResult & FormattedAddressResult>;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const vertex = createVertex({
    project: process.env.GOOGLE_PROJECT_ID || "",
    location: process.env.GOOGLE_PROJECT_REGION || "",
    googleAuthOptions: {
      keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
    },
  });

  const validateMapsKey = () => {
    if (!process.env.GOOGLE_MAPS_ACCESS_TOKEN) {
      throw new Error("Google Maps API key not set");
    }
  }

  const addressToCoordTool = tool({
    description:
      "Converts an address into geographic coordinates",
    inputSchema: z.object({
      address: z.string().describe("The address to geocode."),
    }),
    async *execute(input): AsyncGenerator<Partial<AddressToCoordsResult>> {
      validateMapsKey();

      const accessToken = process.env.GOOGLE_MAPS_ACCESS_TOKEN;

      yield {
        state: "started" as const,
        token: accessToken,
      };

      if (!input.address) {
        throw new Error("address is required");
      }

      let url = "https://geocode.googleapis.com/v4beta/geocode";
      if (input.address) {
        url += `/address/${encodeURIComponent(input.address)}?languageCode=en`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Goog-User-Project": `${process.env.GOOGLE_PROJECT_ID || ""}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch geocode data");
      const data = await response.json();

      if (data?.errorMessage) {
        throw new Error(data.errorMessage);
      }

      if (!Array.isArray(data?.results)) {
        throw new Error("No results found");
      }

      yield {
        state: "completed" as const,
        location: data.results[0]?.location,
      };
    },
  });

  const coordToAddressTool = tool({
    description:
      "Converts geographic coordinates into a human-readable address",
    inputSchema: z.object({
      coordinates: z
        .string()
        .describe("The coordinates to reverse geocode, in the following format: latitude,longitude"),
    }),
    async *execute(input): AsyncGenerator<Partial<CoordsToAddressResult>> {
      validateMapsKey();
      const accessToken = process.env.GOOGLE_MAPS_ACCESS_TOKEN;
      
      yield {
        state: "started" as const,
        token: accessToken,
      };

      if (!input.coordinates) {
        throw new Error("coordinates is required");
      }

      const url = `https://geocode.googleapis.com/v4beta/geocode/location/${input.coordinates}?languageCode=en`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Goog-User-Project": `${process.env.GOOGLE_PROJECT_ID || ""}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch geocode data");
      const data = await response.json();
      console.log("DATA", data);

      if (data?.errorMessage) {
        throw new Error(data.errorMessage);
      }

      if (!Array.isArray(data?.results)) {
        throw new Error("No results found");
      }

      let selectedResult = null;
      for (const result of data.results) {
        if (result.types.includes("point_of_interest")) {
          selectedResult = result;
          continue;
        }

        if (result.types.includes("natural_feature")) {
          selectedResult = result;
          continue;
        }

        if (result.types.includes("airport")) {
          selectedResult = result;
          continue;
        }

        if (result.types.includes("park")) {
          selectedResult = result;
          continue;
        }

        if (result.granularity === "ROOFTOP") {
          selectedResult = result;
          continue;
        }
      }

      if (!selectedResult) {
        throw new Error("no precise address found for coordinates");
      }

      yield {
        state: "completed" as const,
        formattedAddress: selectedResult?.formattedAddress,
      };

      return;
    },
  });

  const result = streamText({
    model: vertex("gemini-2.0-flash-lite-001"),
    messages: convertToModelMessages(messages),
    tools: {
      addressToCoord: addressToCoordTool,
      coordToAddress: coordToAddressTool,
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
