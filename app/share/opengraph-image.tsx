import { ImageResponse } from "next/og";

export const alt = "Import a custom fighter into Celeb Fighter";
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
          background: "linear-gradient(135deg, #141414 0%, #0d2a3a 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -3,
            color: "#90e0ef",
            textShadow: "6px 6px 0 #d31f2b",
          }}
        >
          IMPORT A FIGHTER
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            marginTop: 24,
            color: "#f4f4f4",
          }}
        >
          Paste a share code to add a custom fighter to your roster
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            marginTop: 20,
            padding: "8px 28px",
            border: "3px solid #ffd166",
            borderRadius: 12,
            color: "#ffd166",
          }}
        >
          WBC1.…
        </div>
      </div>
    ),
    size
  );
}
