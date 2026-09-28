import 'server-only';
import { deviceLink, sendDeviceText } from './whatsapp-device';
import { whatsappConnection } from './connections';
import { createAdminClient } from './supabase/admin';
import { subscriptionActive } from './api-error';
import { metaRequest } from './whatsapp-onboarding';
export async function sendWhatsAppText(org: string, phone: string, body: string) {
    const { data: s } = await createAdminClient().from('subscriptions').select('plan,status,next_billing_at').eq('organization_id', org).maybeSingle().throwOnError();
    if (!subscriptionActive(s) || !['Growth', 'Scale'].includes(s?.plan))
        throw new Error('Subscrição incompatível.');
    const to = phone.replace(/\D/g, '');
    if (!/^\d{7,15}$/.test(to))
        throw new Error('Número inválido.');
    const device = await deviceLink(org);
    if (device) {
        if (device.state !== 'open' || !device.phone)
            throw new Error('Confirme a ligação em Conexões antes de enviar.');
        // Do not silently use the official API if the selected device is offline.
        return sendDeviceText(device.instance_name, to, body);
    }
    const c = await whatsappConnection(org);
    if (!c)
        throw new Error('WhatsApp não ligado.');
    const r = await metaRequest<{
        messages?: {
            id: string;
        }[];
    }>(c.phoneNumberId + '/messages', c.token, 'POST', {
        messaging_product: 'whatsapp', to, type: 'text', text: { body },
    });
    if (!r.messages?.[0]?.id)
        throw new Error('Envio não confirmado.');
    return r.messages[0].id;
}
