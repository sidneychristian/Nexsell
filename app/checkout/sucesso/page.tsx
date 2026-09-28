import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function CheckoutSuccess() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07111F] px-6 text-[#F7F9FC]">
      <section className="w-full max-w-lg rounded-[28px] border border-[#233044] bg-[#111B2A] p-8 text-center shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#153B2A] text-[#39E675]">
          <CheckCircle2 size={32} />
        </div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[.15em] text-[#39E675]">
          Pagamento recebido
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          A sua conta está a ser ativada.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#7E8796]">
          Assim que a operadora confirmar o pagamento, poderá entrar no NexSell
          com o mesmo e-mail usado no checkout.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex rounded-xl bg-[#39E675] px-5 py-3 text-sm font-extrabold text-[#07111F]"
        >
          Entrar no NexSell
        </Link>
      </section>
    </main>
  );
}
