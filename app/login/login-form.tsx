"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle, LockKeyhole, Zap } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

const inputClass = "w-full rounded-xl border border-[#233044] bg-[#0C1725] px-3 py-3 text-sm outline-none placeholder:text-[#7E8796] focus:border-[#397BFF]";

export function LoginForm() {
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(event:React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const supabase=createSupabaseBrowserClient();
      if(mode==="signup"){
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});
        if(error) throw error;
        if(!data.session){setMessage("Conta criada. Confirme o e-mail e depois entre no NexSell.");return;}
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error) throw error;
      }
      window.location.href="/";
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível entrar.");
    }finally{setLoading(false)}
  }

  return <section className="w-full max-w-md rounded-[28px] border border-[#233044] bg-[#111B2A] p-7 shadow-2xl">
    <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#39E675] text-[#07111F]"><Zap size={22} fill="currentColor"/></div><div><p className="text-xl font-black">Nex<span className="text-[#39E675]">Sell</span></p><p className="text-xs text-[#7E8796]">Next generation sales</p></div></div>
    <div className="mt-7"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#39E675]"><LockKeyhole size={14}/>{mode==="login"?"Acesso seguro":"Criar acesso"}</p><h1 className="mt-2 text-3xl font-black">{mode==="login"?"Entrar no CRM":"Criar a sua conta"}</h1></div>
    <form onSubmit={submit} className="mt-6 grid gap-4">
      {mode==="signup"&&<input required className={inputClass} placeholder="Nome completo" value={name} onChange={event=>setName(event.target.value)}/>}
      <input required type="email" autoComplete="email" className={inputClass} placeholder="E-mail" value={email} onChange={event=>setEmail(event.target.value)}/>
      <input required type="password" minLength={8} autoComplete={mode==="login"?"current-password":"new-password"} className={inputClass} placeholder="Palavra-passe" value={password} onChange={event=>setPassword(event.target.value)}/>
      {message&&<p className="rounded-xl border border-[#F6C945]/20 bg-[#3D3218] p-3 text-xs leading-5 text-[#F6C945]">{message}</p>}
      <button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-[#39E675] px-4 py-3 text-sm font-black text-[#07111F] disabled:opacity-50">{loading&&<LoaderCircle size={16} className="animate-spin"/>}{mode==="login"?"Entrar":"Criar conta"}</button>
    </form>
    <button onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("")}} className="mt-5 w-full text-center text-xs font-bold text-[#8FB1FF]">{mode==="login"?"Ainda não tem acesso? Criar conta":"Já tem conta? Entrar"}</button>
    <Link href="/" className="mt-4 block text-center text-xs text-[#7E8796]">Voltar ao site</Link>
  </section>;
}
