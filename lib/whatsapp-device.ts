import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
export function deviceConfig() {
    const base = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    try {
        if (!base || !apiKey || !secret || secret.length < 32 || !site)
            return null;
        const b = new URL(base), s = new URL(site);
        if (b.protocol !== 'https:' || b.username || b.password || b.search || b.hash || s.protocol !== 'https:')
            return null;
        return { base: b.href.replace(/\/$/, ''), apiKey, secret, callback: s.origin + '/api/webhooks/whatsapp-device' };
    }
    catch {
        return null;
    }
}
export function instanceSecret(instance: string) {
    const c = deviceConfig();
    if (!c)
        throw new Error('Ligação por dispositivo indisponível. Contacte a equipa.');
    return createHmac('sha256', c.secret).update(instance).digest('hex');
}
export function validDeviceSecret(instance: string, value: string | null) {
    if (!deviceConfig() || !value || !/^[a-f0-9]{64}$/.test(value))
        return false;
    return timingSafeEqual(Buffer.from(instanceSecret(instance)), Buffer.from(value));
}
export class DeviceError extends Error {
    constructor(public status: number) { super('O servidor WhatsApp não confirmou a operação. Tente novamente ou contacte a equipa.'); }
}
export async function evolution<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const c = deviceConfig();
    if (!c)
        throw new Error('Ligação por dispositivo indisponível. Contacte a equipa.');
    const r = await fetch(c.base + path, {
        method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
        headers: { apikey: c.apiKey, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!r.ok)
        throw new DeviceError(r.status);
    return r.json();
}
export async function deviceLink(org: string) {
    const { data } = await createAdminClient().from('whatsapp_device_links').select('*').eq('organization_id', org).maybeSingle().throwOnError();
    return data;
}
export async function deviceState(instance: string) {
    const r = await evolution<{
        instance?: {
            instanceName?: string;
            state?: string;
        };
    }>('/instance/connectionState/' + encodeURIComponent(instance));
    if (r.instance?.instanceName && r.instance.instanceName !== instance)
        throw new DeviceError(502);
    const state = r.instance?.state;
    if (!['open', 'close', 'connecting'].includes(state ?? ''))
        throw new DeviceError(502);
    return state as 'open' | 'close' | 'connecting';
}
export async function verifiedDevicePhone(instance: string) {
    const rows = await evolution<{
        name?: string;
        ownerJid?: string;
    }[]>('/instance/fetchInstances?instanceName=' + encodeURIComponent(instance));
    const found = Array.isArray(rows) ? rows.find(r => r.name === instance) : undefined;
    if (!found?.ownerJid || !/^\d{7,15}(:\d+)?@s\.whatsapp\.net$/.test(found.ownerJid))
        throw new DeviceError(502);
    return found.ownerJid.split('@')[0].split(':')[0];
}
export function safePairing(r: {
    base64?: unknown;
    pairingCode?: unknown;
}) {
    return {
        qr: typeof r.base64 === 'string' && r.base64.length < 150000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.base64) ? r.base64 : null,
        code: typeof r.pairingCode === 'string' && /^[A-Z0-9-]{8,12}$/i.test(r.pairingCode) ? r.pairingCode : null,
    };
}
export async function ensureInstance(instance: string) {
    try {
        await deviceState(instance);
    }
    catch (e) {
        if (!(e instanceof DeviceError) || e.status !== 404)
            throw e;
        await evolution('/instance/create', 'POST', { instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: false, groupsIgnore: true, readMessages: false, readStatus: false, syncFullHistory: false });
    }
    const c = deviceConfig()!;
    await evolution('/webhook/set/' + encodeURIComponent(instance), 'POST', { webhook: {
            enabled: true, url: c.callback, webhookByEvents: false, webhookBase64: false,
            headers: { 'x-nexsell-device-secret': instanceSecret(instance) },
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        } });
}
export async function sendDeviceText(instance: string, to: string, text: string) {
    if (await deviceState(instance) !== 'open')
        throw new Error('WhatsApp desligado. Volte a associar o dispositivo em Conexões.');
    const r = await evolution<{
        key?: {
            id?: string;
        };
    }>('/message/sendText/' + encodeURIComponent(instance), 'POST', { number: to, text });
    if (!r.key?.id)
        throw new DeviceError(502);
    return r.key.id;
}
// Never interpret an opaque WhatsApp LID as a phone number; ignore groups and own echoes.
export function incomingDeviceText(data: unknown) {
    if (!data || typeof data !== 'object')
        return null;
    const d = data as {
        key?: {
            id?: string;
            fromMe?: boolean;
            remoteJid?: string;
            remoteJidAlt?: string;
        };
        message?: {
            conversation?: string;
            extendedTextMessage?: {
                text?: string;
            };
        };
        messageTimestamp?: number;
    };
    if (d.key?.fromMe !== false || !d.key.id || d.key.id.length > 200)
        return null;
    const jid = [d.key.remoteJid, d.key.remoteJidAlt].find(j => typeof j === 'string' && /^\d{7,15}@s\.whatsapp\.net$/.test(j));
    if (!jid || d.key.remoteJid?.endsWith('@g.us'))
        return null;
    const text = d.message?.conversation ?? d.message?.extendedTextMessage?.text;
    if (typeof text !== 'string' || !text.trim() || text.length > 10000)
        return null;
    return { id: d.key.id, from: jid.split('@')[0], type: 'text', text: { body: text }, timestamp: String(d.messageTimestamp ?? Math.floor(Date.now() / 1000)) };
}
