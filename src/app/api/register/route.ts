import { NextResponse } from "next/server";
export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error:
        "Pendaftaran umum ditutup. Gunakan akun yang sudah disediakan pengelola laboratorium.",
    },
    { status: 403 },
  );
}
