import { ImageResponse } from "next/og";

export const alt = "Celeb Fighter — Celebrity Brawl";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Required for `output: "export"`: the image route must be statically rendered.
export const dynamic = "force-static";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #141414 0%, #3a0d0d 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: -4,
            color: "#ffd166",
            textShadow: "6px 6px 0 #d31f2b",
          }}
        >
          CELEB FIGHTER
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 44,
            marginTop: 24,
            color: "#f4f4f4",
          }}
        >
          Pick your celeb. Unleash their special move.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            marginTop: 16,
            color: "#90e0ef",
          }}
        >
          Create + share custom fighters
        </div>
      </div>
    ),
    size
  );
}
