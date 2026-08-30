import { ImageResponse } from "next/og";

export const alt = "Create a custom fighter in Celeb Fighter";
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
          background: "linear-gradient(135deg, #141414 0%, #3a2d0d 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -3,
            color: "#ffd166",
            textShadow: "6px 6px 0 #d31f2b",
          }}
        >
          FIGHTER LAB
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            marginTop: 24,
            color: "#f4f4f4",
          }}
        >
          Design your own fighter — stats, special move, look
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            marginTop: 20,
            padding: "8px 28px",
            border: "3px solid #90e0ef",
            borderRadius: 12,
            color: "#90e0ef",
          }}
        >
          Create → Share → Brawl
        </div>
      </div>
    ),
    size
  );
}
