import { NextResponse } from "next/server";

const GIST_URL =
  "https://gist.githubusercontent.com/devhammed/78cfbee0c36dfdaa4fce7e79c0d39208/raw/";

export type Country = {
  name: string;
  flag: string;
  code: string;
  dial_code: string;
};

export async function GET() {
  try {
    const res = await fetch(GIST_URL, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error("Failed to fetch countries");
    const data = (await res.json()) as Country[];

    // Add Somaliland (same dial code as Somalia)
    const somaliland: Country = {
      name: "Somaliland",
      flag: "🇸🇱",
      code: "XS",
      dial_code: "+252",
    };
    const somaliaIndex = data.findIndex((c) => c.code === "SO");
    const withSomaliland =
      somaliaIndex >= 0
        ? [
            ...data.slice(0, somaliaIndex + 1),
            somaliland,
            ...data.slice(somaliaIndex + 1),
          ]
        : [somaliland, ...data];

    return NextResponse.json(withSomaliland);
  } catch (e) {
    console.error("Countries fetch error:", e);
    return NextResponse.json(
      { error: "Failed to load countries" },
      { status: 500 }
    );
  }
}
