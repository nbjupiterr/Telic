import { ImageResponse } from "next/og";

export const alt = "Telic — The workflow spine for coding agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#090909",
        color: "#f5f5f2",
        display: "flex",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "center",
        overflow: "hidden",
        padding: "72px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          maxWidth: "980px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#a3a3a3",
            display: "flex",
            fontSize: 34,
            marginBottom: 38,
          }}
        >
          TELIC
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: "-4px",
            lineHeight: 1.03,
          }}
        >
          The workflow spine for coding agents.
        </div>
        <div
          style={{
            color: "#a3a3a3",
            display: "flex",
            fontSize: 28,
            marginTop: 38,
          }}
        >
          Prompt · Restructure · Evaluate · Act · Verify · Report
        </div>
      </div>
    </div>,
    size,
  );
}
