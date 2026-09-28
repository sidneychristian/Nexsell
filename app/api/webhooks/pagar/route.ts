import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Pagamentos automáticos desactivados. Aprovação manual necessária.",
    },
    { status: 410 },
  );
}
