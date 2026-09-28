'use client';
import { useEffect, useRef, useState } from 'react';
import { QrCode, Smartphone, CheckCircle2, RefreshCw } from 'lucide-react';
import { Action, Modal, Field } from '../components/nexsell-ui';
import { MetaWhatsAppConnect } from './whatsapp-connect';
type Status = {
    phone?: string;
    available?: boolean;
    exists?: boolean;
    state?: string;
    qr?: string;
    code?: string;
    error?: string;
};
export function WhatsAppConnect({ close, done }: {
    close: () => void;
    done: () => void;
}) {
    const [official, setOfficial] = useState(false), [mode, setMode] = useState<'qr' | 'code'>('qr'), [phone, setPhone] = useState('258'), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState<Status>({}), [error, setError] = useState(''), [qr, setQr] = useState(''), [code, setCode] = useState('');
    const alive = useRef(true);
    async function check() {
        try {
            const r = await fetch('/api/connections/whatsapp/device', { cache: 'no-store' }), j = await r.json();
            if (!alive.current)
                return;
            if (!r.ok)
                throw new Error(j.error);
            setStatus(j);
            if (j.state === 'open') {
                setQr('');
                setCode('');
            }
        }
        catch (e) {
            if (alive.current) {
                setStatus(p => ({ ...p, state: 'unknown' }));
                setError(e instanceof Error ? e.message : 'Não foi possível consultar a ligação.');
            }
        }
    }
    useEffect(() => { alive.current = true; check(); const timer = setInterval(check, 10000); return () => { alive.current = false; clearInterval(timer); }; }, []);
    async function act(action: 'pair' | 'disconnect') {
        setBusy(true);
        setError('');
        setQr('');
        setCode('');
        try {
            const r = await fetch('/api/connections/whatsapp/device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'pair' ? { action, mode, phone: mode === 'code' ? phone.replace(/\D/g, '') : undefined, accepted } : { action }) }), j = await r.json();
            if (!alive.current)
                return;
            if (!r.ok)
                throw new Error(j.error);
            setStatus(p => ({ ...p, ...j }));
            setQr(j.qr ?? '');
            setCode(j.code ?? '');
        }
        catch (e) {
            if (alive.current)
                setError(e instanceof Error ? e.message : 'Tente novamente.');
        }
        finally {
            if (alive.current)
                setBusy(false);
        }
    }
    if (official)
        return <MetaWhatsAppConnect close={() => setOfficial(false)} done={done}/>;
    return <Modal onClose={busy ? () => { } : close} title="Ligar WhatsApp" description="Associe o WhatsApp da sua empresa por QR ou código.">
    <div className="nx-form">
      {status.available === false ? <p className="nx-notice">A equipa está a preparar o servidor de ligação. Ainda não é possível gerar um QR ou código.</p> : status.state === 'open' ? <div className="nx-success"><CheckCircle2 size={28}/><h2 className="text-xl mt-3">Dispositivo ligado</h2><p className="mt-2">{status.phone}</p><p className="mt-2">Configure o agente e os fluxos de atendimento antes de activar as respostas automáticas.</p><Action className="mt-4" onClick={done}>Concluir</Action></div> : <>
        <Field label="Forma de ligação"><select value={mode} disabled={busy} onChange={e => { setMode(e.target.value as 'qr' | 'code'); setQr(''); setCode(''); }}><option value="qr">Ler QR com o telemóvel</option><option value="code">Associar com código</option></select></Field>
        {mode === 'code' && <Field label="Número WhatsApp com indicativo"><input type="tel" inputMode="tel" autoComplete="tel" placeholder="258…" value={phone} onChange={e => setPhone(e.target.value)} disabled={busy}/></Field>}
        <ol className="space-y-2 text-sm"><li>1. Abra o WhatsApp no telemóvel.</li><li>2. Entre em Dispositivos associados → Associar dispositivo.</li><li>{mode === 'qr' ? '3. Leia o QR apresentado abaixo.' : '3. Escolha associar com número de telefone e introduza o código abaixo. A disponibilidade depende da aplicação.'}</li></ol>
        <label className="flex gap-3 text-sm items-start"><input className="mt-1" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/><span>Autorizo associar este WhatsApp ao NexSell. Esta ligação não oficial pode exigir nova associação ou sofrer restrições do WhatsApp.</span></label>
        {qr && <div className="flex justify-center p-4 bg-white rounded-md"><img src={qr} width={260} height={260} className="max-w-full h-auto" alt="QR privado para associar o seu WhatsApp"/></div>}
        {code && <div className="p-5 border border-white/15 rounded-md text-center"><p className="text-sm mb-3">Introduza no WhatsApp</p><output className="text-3xl font-mono tracking-widest break-all">{code}</output></div>}
        {(qr || code) && <p className="text-sm" role="status">A aguardar confirmação no telemóvel. Se o QR ou código expirar, gere outro. Não partilhe esta ligação.</p>}
        <Action busy={busy} disabled={!accepted || status.available !== true || status.state === 'disconnecting'} onClick={() => act('pair')}>{mode === 'qr' ? <QrCode size={18}/> : <Smartphone size={18}/>} {qr || code ? 'Gerar novamente' : mode === 'qr' ? 'Gerar QR' : 'Gerar código'}</Action>
      </>}
      {error && <p className="nx-error" role="alert">{error}</p>}
      <Action secondary disabled={busy} onClick={() => { setError(''); check(); }}><RefreshCw size={16}/>Verificar ligação</Action>
      {status.exists && <><p className="text-sm">Desligar termina a sessão do NexSell. Poderá voltar a associar o número.</p><Action secondary busy={busy} onClick={() => act('disconnect')}>{status.state === 'disconnecting' ? 'Tentar concluir desligação' : 'Desligar dispositivo'}</Action></>}
      {!status.exists && <button type="button" className="text-sm text-left underline underline-offset-4" onClick={() => setOfficial(true)}>Usar a integração oficial Meta</button>}
    </div>
  </Modal>;
}
