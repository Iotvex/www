import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** UI catalog only — agent does not own effect names. */
const EFFECTS = [
  { id: 0, name: "solid" },
  { id: 1, name: "rainbow" },
  { id: 2, name: "chase" },
  { id: 3, name: "pulse" },
  { id: 4, name: "sparkle" },
  { id: 5, name: "theater" },
  { id: 6, name: "fire" },
  { id: 7, name: "comet" },
  { id: 8, name: "wave" },
  { id: 9, name: "scanner" },
  { id: 10, name: "twinkle" },
  { id: 11, name: "gradient" },
  { id: 12, name: "color_loop" },
  { id: 13, name: "snow" },
]

export async function GET() {
  return NextResponse.json({ effects: EFFECTS, source: "www" })
}
