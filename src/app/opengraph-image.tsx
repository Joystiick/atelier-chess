import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Atelier Chess";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(145deg, #0c1210 0%, #1a2e24 50%, #0a0e0c 100%)",
          color: "#f4e8d0",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 88, letterSpacing: -2 }}>Atelier</div>
        <div style={{ fontSize: 36, color: "#c9a227", marginTop: 12 }}>
          Chess for two — codes, clocks, AI
        </div>
      </div>
    ),
    { ...size },
  );
}
