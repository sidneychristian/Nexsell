"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleCheck, CircleX, LoaderCircle, LockKeyhole, MessageCircle, ShieldCheck, Smartphone, Sparkles, X, Zap } from "lucide-react";
import { toast, Toaster } from "sonner";
import { NEXSELL_PLANS, type PlanKey } from "./plans";

import { TRANSFER_DETAILS } from "./payment-details";
type PaymentMethod = "BCI" | "EMOLA";
type PaymentState = { reference: string; status: string; message?: string | null; method:PaymentMethod; amount:number };

const inputClass = "w-full rounded-xl border border-[#233044] bg-[#0C1725] px-3 py-3 text-sm text-[#F7F9FC] outline-none placeholder:text-[#7E8796] focus:border-[#397BFF]";
const money = (amount:number) => new Intl.NumberFormat("pt-MZ", { maximumFractionDigits:0 }).format(amount);
const terminalStatuses = new Set(["paid", "failed", "cancelled", "reconciliation_required", "configuration_required"]);

function methodName(method: PaymentMethod) {
  return method === "BCI" ? "BCI" : "e-Mola";
}

export function PublicHome({ signedIn = false }:{signedIn?:boolean}) {
  const [checkout, setCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("growth");
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [form, setForm] = useState({ name:"", email:"", phone:"", company:"", method:"EMOLA" as PaymentMethod });
  const plan = NEXSELL_PLANS.find(item=>item.key===selectedPlan) ?? NEXSELL_PLANS[1];
  const paymentReference = payment?.reference;
  const paymentStatus = payment?.status;

  function choosePlan(key:PlanKey){
    if(!signedIn){window.location.href="/login";return;}
    setSelectedPlan(key);
    setPayment(null);
    setCheckout(true);
  }

  useEffect(() => {
    if(!signedIn)return;
    let live=true;let initial=true;
    const refresh=async()=>{try{const r=await fetch("/api/billing/status",{cache:"no-store"});if(r.ok){const j=await r.json();if(live&&j.payment){setPayment(j.payment);if(initial)setCheckout(true);initial=false;}}}catch{}};
    refresh();const timer=window.setInterval(refresh,15000);
    return()=>{live=false;window.clearInterval(timer)};
  },[signedIn]);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setPayment(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,plan:selectedPlan}),
      });
      const payload = await response.json() as PaymentState & { error?:string; requestRecorded?:boolean };
      if (payload.reference && payload.status) setPayment(payload);
      if (!response.ok) throw new Error(payload.error || "Não foi possível iniciar o pagamento.");
      toast.success("Pedido criado. Transfira e envie o comprovativo.");
    } catch (error:unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="nex-grid relative min-h-screen overflow-hidden bg-[#07111F] text-white">
    <Toaster position="top-right" richColors/>
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-cover bg-center opacity-[.14] mix-blend-screen" style={{backgroundImage:"url('/og.png')"}}/>
    <div className="relative mx-auto max-w-7xl px-6 py-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#39E675] text-[#07111F]"><Zap size={19} fill="currentColor"/></div>
          <div><div className="text-[19px] font-black tracking-[-.04em]">Nex<span className="text-[#39E675]">Sell</span></div><div className="text-[9px] uppercase tracking-[.18em] text-white/40">Next generation sales</div></div>
        </div>
        <a href="/login" className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-extrabold hover:bg-white/5">Entrar no CRM</a>
      </header>

      <section className="mx-auto max-w-4xl py-16 text-center sm:py-24">
        {signedIn&&<div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[#F6C945]/20 bg-[#3D3218] px-3 py-2 text-xs font-bold text-[#F6C945]"><LockKeyhole size={14}/> Esta conta ainda não tem uma subscrição ativa</div>}
        <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-[#39E675]/25 bg-[#39E675]/10 px-3 py-2 text-xs font-bold text-[#39E675]"><Sparkles size={14}/> CRM + WhatsApp + IA + n8n</div>
        <h1 className="text-5xl font-black leading-[.96] tracking-[-.06em] sm:text-7xl">Transforme conversas em <span className="text-[#39E675]">vendas previsíveis.</span></h1>
        <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Escolha a capacidade certa para começar. Todos os planos organizam os leads, aceleram o WhatsApp e mostram onde agir para fechar mais negócios.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm text-white/65">
          {["Sem taxa de configuração","Ativação após confirmação","Cancele quando quiser"].map(x=><span key={x} className="flex items-center gap-2"><Check size={16} className="text-[#39E675]"/>{x}</span>)}
        </div>
      </section>

      <section className="pb-20">
        <div className="mb-7 text-center">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#39E675]">Oferta de lançamento</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Um plano para cada fase da empresa</h2>
          <p className="mt-2 text-sm text-[#7E8796]">Configuração inicial incluída em todos os planos.</p>
        </div>
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {NEXSELL_PLANS.map(item=><article key={item.key} className={`relative flex flex-col rounded-[28px] border p-6 shadow-2xl ${item.featured?"border-[#39E675] bg-[#111B2A] shadow-[#39E675]/10 lg:-translate-y-3":"border-[#233044] bg-[#0D1827]"}`}>
            {item.featured&&<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#39E675] px-4 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#07111F]">Mais escolhido</span>}
            <p className={`text-[10px] font-black uppercase tracking-[.14em] ${item.featured?"text-[#39E675]":"text-[#6E9CFF]"}`}>{item.badge}</p>
            <h3 className="mt-3 text-2xl font-black">{item.name}</h3>
            <p className="mt-2 min-h-10 text-xs leading-5 text-[#7E8796]">{item.audience}</p>
            <p className="mt-6 text-4xl font-black tracking-tight">{money(item.monthlyAmount)} MT<span className="text-xs font-semibold text-[#7E8796]"> / mês</span></p>
            <div className="my-7 flex-1 space-y-3">{item.features.map(feature=><p key={feature} className="flex items-start gap-2 text-xs leading-5 text-white/70"><Check size={15} className="mt-0.5 shrink-0 text-[#39E675]"/>{feature}</p>)}</div>
            <button onClick={()=>choosePlan(item.key)} className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-extrabold ${item.featured?"bg-[#39E675] text-[#07111F] hover:bg-[#51EE85]":"border border-[#397BFF]/40 bg-[#142C55] text-[#8FB1FF] hover:bg-[#19386A]"}`}>Escolher {item.name} <ArrowRight size={16}/></button>
          </article>)}
        </div>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 rounded-2xl border border-[#233044] bg-[#111B2A] p-5 sm:grid-cols-2">
          <div><p className="flex items-center gap-2 text-xs font-extrabold"><ShieldCheck size={16} className="text-[#39E675]"/> Pagamento protegido</p><p className="mt-2 text-xs leading-5 text-[#7E8796]">Transfira, envie o comprovativo e aguarde a conferência pela nossa equipa. Nunca pedimos o seu PIN.</p></div>
          <div><p className="flex items-center gap-2 text-xs font-extrabold"><Smartphone size={16} className="text-[#39E675]"/> e-Mola e transferência BCI</p><p className="mt-2 text-xs leading-5 text-[#7E8796]">Os dados do beneficiário aparecem antes da transferência. O acesso depende de aprovação manual.</p></div>
        </div>
      </section>
    </div>

    {checkout&&<div className="fixed inset-0 z-50 grid place-items-center bg-[#07111F]/80 p-4 backdrop-blur" onMouseDown={()=>setCheckout(false)}>
      <section onMouseDown={event=>event.stopPropagation()} className="scrollbar-none max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#233044] bg-[#111B2A] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#39E675]">Subscrição segura</p><h2 className="mt-1 text-2xl font-black">Plano {plan.name}</h2><p className="mt-1 text-sm font-extrabold text-[#8FB1FF]">{money(plan.monthlyAmount)} MT / mês</p></div>
          <button aria-label="Fechar" onClick={()=>setCheckout(false)} className="rounded-xl bg-[#1B293A] p-2"><X size={18}/></button>
        </div>

        {payment ? <PaymentResult payment={payment} onChange={setPayment}/> : <form onSubmit={pay} className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input required className={inputClass} placeholder="Nome completo" value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/>
            <input className={inputClass} placeholder="Empresa" value={form.company} onChange={event=>setForm({...form,company:event.target.value})}/>
          </div>
          <input required type="email" className={inputClass} placeholder="E-mail de acesso" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/>
          <div className="grid grid-cols-2 gap-3">
            {(["EMOLA","BCI"] as PaymentMethod[]).map(method=><button key={method} type="button" onClick={()=>setForm({...form,method})} className={`rounded-xl border p-3 text-left transition ${form.method===method?"border-[#39E675] bg-[#10291F]":"border-[#233044] bg-[#0C1725]"}`}>
              <span className="flex items-center gap-2 text-sm font-black"><span className={`h-3 w-3 rounded-full ${method==="BCI"?"bg-[#E63D35]":"bg-[#EE8D25]"}`}/>{methodName(method)}</span>
              <span className="mt-1 block text-[10px] text-[#7E8796]">Aprovação manual</span>
            </button>)}
          </div>
          <input required inputMode="tel" autoComplete="tel" className={inputClass} placeholder="O seu WhatsApp: 8X XXX XXXX" value={form.phone} onChange={event=>setForm({...form,phone:event.target.value})}/>
          <div className="rounded-xl bg-[#0C1725] p-4 text-xs leading-5 text-[#7E8796]">Na próxima etapa verá os dados para transferir e enviar o comprovativo. <strong className="text-white/75">Nunca introduza o seu PIN no NexSell.</strong></div>
          <button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-[#39E675] px-5 py-3.5 text-sm font-extrabold text-[#07111F] disabled:opacity-50">{saving?<LoaderCircle size={17} className="animate-spin"/>:<Smartphone size={17}/>} Ver dados para transferir {money(plan.monthlyAmount)} MT</button>
        </form>}
      </section>
    </div>}
  </main>;
}

function PaymentResult({payment,onChange}:{payment:PaymentState;onChange:(p:PaymentState)=>void}) {
 const [file,setFile]=useState<File|null>(null);const [transaction,setTransaction]=useState("");const [busy,setBusy]=useState(false);
 const detail=TRANSFER_DETAILS[payment.method]??TRANSFER_DETAILS.EMOLA;
 async function send(e:React.FormEvent){e.preventDefault();if(!file)return;setBusy(true);try{
 const data=new FormData();data.set("file",file);data.set("reference",payment.reference);data.set("transaction",transaction);
 const r=await fetch("/api/billing/proof",{method:"POST",body:data});const j=await r.json();if(!r.ok)throw new Error(j.error);
 onChange({...payment,status:"under_review",message:null});toast.success("Comprovativo enviado. Aguarde aprovação.");
 }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível enviar.")}finally{setBusy(false)}}
 if(payment.status==="paid")return <div className="mt-6 rounded-2xl bg-[#10291F] p-5"><CircleCheck className="text-[#39E675]"/><h3 className="mt-3 text-xl font-bold">Pagamento aprovado</h3><p className="mt-2">O seu plano está activo.</p><a href="/" className="mt-5 block font-bold text-[#39E675]">Abrir o NexSell →</a></div>;
 return <div className="mt-6 space-y-5 text-sm">
 <div className="rounded-2xl bg-[#0C1725] p-5"><p className="text-[#8FB1FF]">Transferir por {detail.label}</p><p className="mt-2 text-3xl font-black">{money(payment.amount)} MT</p><p className="mt-3">Beneficiário: <strong>{detail.holder}</strong></p>{detail.fields.map(([label,value])=><div key={label} className="mt-4"><p className="text-[#7E8796]">{label}</p><div className="mt-1 flex items-center gap-2"><strong className="break-all">{value}</strong><button className="ml-auto rounded-lg border border-[#233044] px-3 py-2" onClick={async()=>{try{await navigator.clipboard.writeText(value);toast.success("Copiado")}catch{toast.error("Seleccione o número para copiar.")}}}>Copiar</button></div></div>)}<p className="mt-4 text-xs text-[#7E8796]">Confirme o nome do beneficiário no seu aplicativo antes de transferir.</p></div>
 <p className="break-all text-xs text-[#7E8796]">Pedido: {payment.reference}</p>
 {payment.status==="under_review"?<div role="status" className="rounded-xl bg-[#3D3218] p-4 text-[#F6C945]"><strong>Comprovativo em análise</strong><p className="mt-2">Pode fechar esta página. Ao voltar a entrar, verá o estado actualizado. O acesso será activado após aprovação.</p></div>:<form onSubmit={send} className="space-y-4">
 {payment.status==="rejected"&&<p role="alert" className="rounded-xl bg-[#402329] p-4 text-[#FF7A83]">Comprovativo recusado: {payment.message}. Corrija e envie novamente.</p>}
 <label className="block">Referência da transferência<input required minLength={3} maxLength={100} className={inputClass+" mt-2"} value={transaction} onChange={e=>setTransaction(e.target.value)} placeholder="Código da transacção no recibo"/></label>
 <label className="block">Comprovativo — PDF, JPG ou PNG, até 3 MB<input required type="file" accept="application/pdf,image/jpeg,image/png" className="mt-2 block w-full rounded-xl border border-[#233044] p-3" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
 <button disabled={busy} className="w-full rounded-xl bg-[#39E675] px-4 py-3 font-bold text-[#07111F] disabled:opacity-50">{busy?"A enviar…":"Enviar comprovativo"}</button><p className="text-xs text-[#7E8796]">O envio não confirma o pagamento. A equipa verifica a entrada do valor e aprova o acesso.</p>
 </form>}
 </div>;
}
