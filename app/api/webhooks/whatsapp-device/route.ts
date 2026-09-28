import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { subscriptionActive } from '../../../../lib/api-error';
import { validDeviceSecret, incomingDeviceText } from '../../../../lib/whatsapp-device';
export async function POST(request: Request) {
    const raw = await request.text();
    if (raw.length > 1000000)
        return new Response('Too large', { status: 413 });
    let p;
    try {
        p = JSON.parse(raw);
    }
    catch {
        return new Response('Invalid payload', { status: 400 });
    }
    if (typeof p?.instance !== 'string' || !/^nx_[a-f0-9]{32}$/.test(p.instance) || !validDeviceSecret(p.instance, request.headers.get('x-nexsell-device-secret')))
        return new Response('Unauthorized', { status: 401 });
    try {
        const db = createAdminClient();
        const { data: link } = await db.from('whatsapp_device_links').select('*').eq('instance_name', p.instance).maybeSingle().throwOnError();
        if (!link || link.state !== 'open' || !link.phone)
            return NextResponse.json({ received: true });
        const { data: s } = await db.from('subscriptions').select('plan,status,next_billing_at').eq('organization_id', link.organization_id).maybeSingle().throwOnError();
        if (!subscriptionActive(s) || !['Growth', 'Scale'].includes(s?.plan))
            return NextResponse.json({ received: true });
        // Status is verified by polling the gateway, not asserted by the incoming payload.
        if (p.event !== 'messages.upsert')
            return NextResponse.json({ received: true });
        const messages = (Array.isArray(p.data) ? p.data : [p.data]).map(incomingDeviceText).filter(Boolean);
        if (!messages.length)
            return NextResponse.json({ received: true });
        if (!process.env.N8N_WEBHOOK_URL || !process.env.N8N_OUTBOUND_SECRET)
            throw new Error('Missing receiver');
        const r = await fetch(process.env.N8N_WEBHOOK_URL, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', 'x-nexsell-secret': process.env.N8N_OUTBOUND_SECRET }, body: JSON.stringify({ event: 'whatsapp.event', provider: 'device', organizationId: link.organization_id, field: 'messages', value: { messages } }) });
        if (!r.ok)
            throw new Error('Delivery');
        return NextResponse.json({ received: true });
    }
    catch {
        return new Response('Retry', { status: 503 });
    }
}
