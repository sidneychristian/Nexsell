import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgentAccess } from '../../../../../lib/agent-access';
import { planHasFeature } from '../../../../plans';
import { deviceConfig, deviceLink, deviceState, ensureInstance, evolution, safePairing, DeviceError, verifiedDevicePhone } from '../../../../../lib/whatsapp-device';
export const maxDuration = 60;
function json(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, { ...init, headers: { 'Cache-Control': 'no-store' } });
}
async function owner() {
    const a = await getAgentAccess();
    if ('error' in a)
        return a;
    if (!planHasFeature(a.planKey, 'connections'))
        return { error: 'A ligação WhatsApp está disponível a partir do Growth. Suba o pacote para continuar.', status: 403 } as const;
    const { data: m } = await a.db.from('memberships').select('role').eq('organization_id', a.organizationId).eq('user_email', a.user.email).maybeSingle();
    if (m?.role !== 'owner')
        return { error: 'Só o proprietário pode gerir esta ligação.', status: 403 } as const;
    return a;
}
function failure(e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : '';
    return json({ error: msg.includes('PAIR_RATE_LIMIT') ? 'Aguarde 30 segundos antes de gerar outra ligação.' : 'Não foi possível confirmar a ligação. Verifique o servidor ou tente novamente.' }, { status: 409 });
}
export async function GET() {
    const a = await owner();
    if ('error' in a)
        return json({ error: a.error }, { status: a.status });
    try {
        const link = await deviceLink(a.organizationId);
        if (!deviceConfig())
            return json({ available: false, exists: !!link, state: 'unavailable' });
        if (!link)
            return json({ available: true, exists: false, state: 'close' });
        if (link.state === 'disconnecting')
            return json({ available: true, exists: true, state: 'disconnecting' });
        let state: 'open' | 'close' | 'connecting' = 'close';
        try {
            state = await deviceState(link.instance_name);
        }
        catch (e) {
            if (!(e instanceof DeviceError) || e.status !== 404)
                throw e;
        }
        const phone = state === 'open' ? await verifiedDevicePhone(link.instance_name) : link.phone;
        await a.db.from('whatsapp_device_links').update({ state, phone, checked_at: new Date().toISOString() }).eq('organization_id', a.organizationId).neq('state', 'disconnecting').throwOnError();
        return json({ available: true, exists: true, state, phone });
    }
    catch (e) {
        return failure(e);
    }
}
const schema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('pair'), mode: z.enum(['qr', 'code']), phone: z.string().regex(/^\d{7,15}$/).optional(), accepted: z.literal(true) }),
    z.object({ action: z.literal('disconnect') }),
]);
export async function POST(request: Request) {
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return json({ error: 'Origem inválida.' }, { status: 403 });
    const a = await owner();
    if ('error' in a)
        return json({ error: a.error }, { status: a.status });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
        return json({ error: 'Verifique os dados.' }, { status: 400 });
    try {
        if (!deviceConfig())
            return json({ error: 'A equipa ainda não configurou o servidor WhatsApp.' }, { status: 503 });
        const d = parsed.data;
        if (d.action === 'disconnect') {
            const link = await deviceLink(a.organizationId);
            if (link) {
                // Disable local sends before external logout; failure leaves a retryable blocked state.
                await a.db.from('whatsapp_device_links').update({ state: 'disconnecting' }).eq('organization_id', a.organizationId).throwOnError();
                try {
                    if (await deviceState(link.instance_name) !== 'close')
                        await evolution('/instance/logout/' + encodeURIComponent(link.instance_name), 'DELETE');
                    await evolution('/instance/delete/' + encodeURIComponent(link.instance_name), 'DELETE');
                }
                catch (e) {
                    if (!(e instanceof DeviceError) || e.status !== 404)
                        throw e;
                }
                // Keep the selection as a tombstone: never fall back to a retained Meta token.
                await a.db.from('whatsapp_device_links').update({ state: 'close', checked_at: new Date().toISOString() }).eq('organization_id', a.organizationId).throwOnError();
                await a.db.from('admin_audit').insert({ actor: a.user.email, action: 'whatsapp_device_disconnected', details: { organizationId: a.organizationId } }).throwOnError();
            }
            return json({ success: true, state: 'close', exists: !!link });
        }
        if (d.mode === 'code' && !d.phone)
            return json({ error: 'Indique o número com indicativo, por exemplo 258…' }, { status: 400 });
        const { data: instance } = await a.db.rpc('prepare_whatsapp_device', { p_org: a.organizationId }).throwOnError();
        await ensureInstance(instance);
        const state = await deviceState(instance);
        if (state === 'open')
            return GET();
        const result = await evolution<{
            base64?: string;
            pairingCode?: string;
        }>('/instance/connect/' + encodeURIComponent(instance) + (d.mode === 'code' ? '?number=' + encodeURIComponent(d.phone!) : ''));
        const pair = safePairing(result);
        if ((d.mode === 'qr' && !pair.qr) || (d.mode === 'code' && !pair.code))
            return json({ error: 'O servidor ainda não disponibilizou ' + (d.mode === 'qr' ? 'o QR.' : 'o código.') + ' Aguarde e tente novamente.' }, { status: 409 });
        await a.db.from('admin_audit').insert({ actor: a.user.email, action: 'whatsapp_device_pair_requested', details: { organizationId: a.organizationId, mode: d.mode } }).throwOnError();
        return json({ state: 'connecting', exists: true, ...pair });
    }
    catch (e) {
        return failure(e);
    }
}
