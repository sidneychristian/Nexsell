import test from 'node:test';
import assert from 'node:assert/strict';
import { safePairing, incomingDeviceText, deviceConfig, validDeviceSecret, instanceSecret, evolution } from '../lib/whatsapp-device';
import { POST as receive } from '../app/api/webhooks/whatsapp-device/route';
import { POST as connect } from '../app/api/connections/whatsapp/device/route';
test('QR não aceita URL remota ou SVG; código validado', () => {
    assert.equal(safePairing({ base64: 'https://tracker.example/qr' }).qr, null);
    assert.equal(safePairing({ base64: 'data:image/svg+xml;base64,AA==' }).qr, null);
    assert.equal(safePairing({ base64: 'data:image/png;base64,AA==' }).qr, 'data:image/png;base64,AA==');
    assert.equal(safePairing({ pairingCode: 'ABCD1234' }).code, 'ABCD1234');
    assert.equal(safePairing({ pairingCode: '<script>' }).code, null);
});
test('mensagens próprias, grupos e LID opaco não viram leads ou respostas', () => {
    const key = { id: 'msg-1', fromMe: false, remoteJid: '258841234567@s.whatsapp.net' };
    assert.equal(incomingDeviceText({ key, message: { conversation: 'Olá' } })?.from, '258841234567');
    assert.equal(incomingDeviceText({ key: { ...key, fromMe: true }, message: { conversation: 'Olá' } }), null);
    assert.equal(incomingDeviceText({ key: { ...key, remoteJid: '12000@g.us' }, message: { conversation: 'Olá' } }), null);
    assert.equal(incomingDeviceText({ key: { ...key, remoteJid: '12345678@lid' }, message: { conversation: 'Olá' } }), null);
});
test('segredo por instância e rejeição de webhook e origens inválidas', async () => {
    const old = { ...process.env };
    try {
        process.env.EVOLUTION_API_URL = 'https://gateway.example';
        process.env.EVOLUTION_API_KEY = 'test-key';
        process.env.EVOLUTION_WEBHOOK_SECRET = 'x'.repeat(40);
        process.env.NEXT_PUBLIC_SITE_URL = 'https://nexsellmz.vercel.app';
        assert.ok(deviceConfig());
        const one = 'nx_' + 'a'.repeat(32), two = 'nx_' + 'b'.repeat(32);
        assert.equal(validDeviceSecret(one, instanceSecret(one)), true);
        assert.equal(validDeviceSecret(two, instanceSecret(one)), false);
        assert.equal((await receive(new Request('https://nexsellmz.vercel.app/api/webhooks/whatsapp-device', { method: 'POST', body: JSON.stringify({ instance: one }) }))).status, 401);
        assert.equal((await connect(new Request('https://nexsellmz.vercel.app/api/connections/whatsapp/device', { method: 'POST', headers: { origin: 'https://other.example' }, body: '{}' }))).status, 403);
        process.env.EVOLUTION_API_URL = 'http://gateway.example';
        assert.equal(deviceConfig(), null);
    }
    finally {
        for (const k of Object.keys(process.env))
            if (!(k in old))
                delete process.env[k];
        Object.assign(process.env, old);
    }
});
test('gateway recusa erro HTTP, timeout externo não é sucesso', async () => {
    const old = { ...process.env }, original = globalThis.fetch;
    try {
        process.env.EVOLUTION_API_URL = 'https://gateway.example';
        process.env.EVOLUTION_API_KEY = 'test-key';
        process.env.EVOLUTION_WEBHOOK_SECRET = 'x'.repeat(40);
        process.env.NEXT_PUBLIC_SITE_URL = 'https://nexsellmz.vercel.app';
        globalThis.fetch = async () => new Response('{}', { status: 500 });
        await assert.rejects(evolution('/instance/connect/test'));
    }
    finally {
        globalThis.fetch = original;
        for (const k of Object.keys(process.env))
            if (!(k in old))
                delete process.env[k];
        Object.assign(process.env, old);
    }
});
