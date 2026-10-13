import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSize = Number(searchParams.get("size") || "512");
  const size = rawSize === 192 || rawSize === 180 ? rawSize : 512;
  const maskable = searchParams.get("maskable") === "1";

  const radius = maskable ? 0 : Math.round(size * 0.22);
  const svgSize = Math.round(size * (maskable ? 0.62 : 0.72));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #070B14 0%, #0F1E38 100%)",
          borderRadius: radius,
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="16" cy="16" r="10.5" stroke="#F8FAFC" strokeWidth="2.1" />
          <path
            d="M5.6 16.15C9.8 19.1 22.2 19.1 26.4 16.15"
            stroke="#F8FAFC"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M16 5.6C22.1 9.3 22.1 22.7 16 26.4"
            stroke="#38BDF8"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
