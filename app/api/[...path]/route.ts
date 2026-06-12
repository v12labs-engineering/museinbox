import { handleApiRequest } from "../../../server/next-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApiRequest(request);
}

export async function POST(request: Request) {
  return handleApiRequest(request);
}

export async function PUT(request: Request) {
  return handleApiRequest(request);
}

export async function DELETE(request: Request) {
  return handleApiRequest(request);
}
