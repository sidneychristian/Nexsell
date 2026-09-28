import { mkdir, copyFile, rm } from "node:fs/promises";
// Apenas monta componentes com fixtures locais. Não altera autenticação nem APIs.
if (process.argv.includes("--clean"))
  await rm("app/review", { recursive: true, force: true });
else {
  await mkdir("app/review", { recursive: true });
  await copyFile("tests/visual-fixture.tsx", "app/review/page.tsx");
  console.log(
    "Revisão local: /review?surface=workspace e /review?mobile=1. Limpar com npm run qa:clean antes de compilar.",
  );
}
