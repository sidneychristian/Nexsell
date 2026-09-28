"use client";
import { createSupabaseBrowserClient } from "./supabase/client";

// O corpo do ficheiro vai directamente para Storage, sem o limite HTTP da Vercel.
export async function uploadPrivateFile(file: File) {
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("Escolha um ficheiro até 10 MB.");
  const r = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Não foi possível preparar o envio.");
  const { error } = await createSupabaseBrowserClient()
    .storage.from("nexsell-uploads")
    .uploadToSignedUrl(data.key, data.token, file, { contentType: file.type });
  if (error)
    throw new Error("O envio falhou. Verifique a ligação e tente novamente.");
  return {
    key: data.key as string,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}
