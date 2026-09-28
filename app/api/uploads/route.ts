import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getAgentAccess } from "../../../lib/agent-access";

export const dynamic = "force-dynamic";
const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "audio/ogg",
  "audio/mpeg",
]);

export async function POST(request: Request) {
  const access = await getAgentAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const { user } = access;
  if (request.headers.get("content-type")?.includes("application/json")) {
    const value = await request.json().catch(() => null);
    if (
      !value ||
      typeof value.name !== "string" ||
      value.name.length > 255 ||
      !allowed.has(value.type) ||
      !Number.isInteger(value.size) ||
      value.size <= 0 ||
      value.size > 10 * 1024 * 1024
    )
      return NextResponse.json(
        { error: "Ficheiro inválido. Máximo 10 MB." },
        { status: 400 },
      );
    const key = `${user.id}/${crypto.randomUUID()}-${value.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { data, error } = await createAdminClient()
      .storage.from("nexsell-uploads")
      .createSignedUploadUrl(key, { upsert: false });
    if (error || !data)
      return NextResponse.json(
        { error: "Não foi possível autorizar o envio." },
        { status: 500 },
      );
    return NextResponse.json({ key, token: data.token });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Ficheiro em falta" }, { status: 400 });
  if (!allowed.has(file.type) || file.size > 10 * 1024 * 1024)
    return NextResponse.json(
      {
        error: "Use PDF, DOCX, PPTX, TXT, imagem ou áudio com no máximo 10 MB.",
      },
      { status: 400 },
    );
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const key = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const db = createAdminClient();
  const { error } = await db.storage
    .from("nexsell-uploads")
    .upload(key, file, { contentType: file.type, upsert: false });
  if (error)
    return NextResponse.json(
      { error: "Não foi possível guardar o ficheiro." },
      { status: 500 },
    );
  return NextResponse.json({
    key,
    name: file.name,
    type: file.type,
    size: file.size,
  });
}

export async function GET(request: Request) {
  const access = await getAgentAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const { user } = access;
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !key.startsWith(`${user.id}/`))
    return NextResponse.json({ error: "Ficheiro inválido" }, { status: 403 });
  const db = createAdminClient();
  const { data, error } = await db.storage
    .from("nexsell-uploads")
    .createSignedUrl(key, 3600);
  if (error || !data)
    return NextResponse.json(
      { error: "Ficheiro não encontrado" },
      { status: 404 },
    );
  return NextResponse.redirect(data.signedUrl, 302);
}
