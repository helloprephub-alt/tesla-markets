import { router, json, error, db, storage, requireAuth, requireAdminEmailAllowlist, withScopes, ai } from '@appdeploy/sdk';

const ADMIN_EMAILS = ['helloprephub@gmail.com'];
const admin = [requireAuth(), withScopes('email'), requireAdminEmailAllowlist(ADMIN_EMAILS)];
const now = () => Date.now();
const validId = (id: string) => /^[A-Za-z0-9_-]{8,100}$/.test(id);

async function getThread(threadId: string) {
  if (!validId(threadId)) return null;
  const [thread] = await db.get('enquiry_threads', [threadId], { consistent: true });
  return thread;
}
async function signedMessages(threadId: string) {
  const { items } = await db.list('enquiry_messages', { limit: 500 });
  const messages = items.filter((m: any) => m.threadId === threadId).sort((a: any,b: any) => a.createdAt-b.createdAt);
  const paths = messages.filter((m: any) => m.attachmentPath).map((m: any) => m.attachmentPath as string);
  const urls = paths.length ? await storage.url(paths) : [];
  const urlMap = new Map(urls.map((x: any) => [x.path, x.url]));
  return messages.map((m: any) => ({ ...m, attachmentUrl: m.attachmentPath ? urlMap.get(m.attachmentPath) : null, attachmentPath: undefined }));
}
async function addMessage(threadId: string, sender: 'visitor'|'admin', text: string, attachment?: { data: string; mimeType: string }) {
  if (!text.trim() && !attachment) throw new Error('Write a message or attach an image.');
  if (text.length > 4000) throw new Error('Message is too long.');
  let attachmentPath: string | undefined;
  if (attachment) {
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(attachment.mimeType)) throw new Error('Only JPG, PNG, WEBP or GIF images are supported.');
    if (attachment.data.length > 4_000_000) throw new Error('Image must be smaller than 3 MB.');
    attachmentPath = 'enquiries/' + threadId + '/' + now() + '.img';
    const [ok] = await storage.write([{ path: attachmentPath, content: attachment.data, contentType: attachment.mimeType }]);
    if (!ok) throw new Error('Image upload failed. Please try again.');
  }
  const record = { threadId, sender, text: text.trim(), attachmentPath: attachmentPath || null, createdAt: now() };
  const [id] = await db.add('enquiry_messages', [record]);
  if (!id) throw new Error('Message could not be saved.');
  const [thread] = await db.get('enquiry_threads', [threadId], { consistent: true });
  if (thread) await db.tx.update('enquiry_threads', [{ id: threadId, record: { updatedAt: now(), lastMessage: text.trim() || 'Image attachment' } }], { patch: true });
  return { id, ...record };
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ ok: true })],
  'GET /api/vehicle-gallery/generated': [async () => {
    const { items } = await db.list('generated_vehicle_images', { limit: 30 });
    const sorted = items.sort((a: any,b: any) => b.createdAt-a.createdAt);
    const urls = sorted.length ? await storage.url(sorted.map((x: any) => x.path)) : [];
    const urlMap = new Map(urls.map((x: any) => [x.path, x.url]));
    return json({ images: sorted.map((x: any) => ({ id: x.id, label: x.label, note: x.note, url: urlMap.get(x.path) })) });
  }],
  'POST /api/enquiries': [async ({ body }) => {
    const input = (body || {}) as { visitorName?: string; visitorEmail?: string };
    const [id] = await db.add('enquiry_threads', [{ visitorName: (input.visitorName || 'Website visitor').slice(0,80), visitorEmail: (input.visitorEmail || '').slice(0,160), createdAt: now(), updatedAt: now(), lastMessage: '' }]);
    if (!id) return error('Could not start an enquiry.', 500);
    return json({ threadId: id });
  }],
  'GET /api/enquiries/:id/messages': [async ({ params }) => {
    const thread = await getThread(params.id);
    if (!thread) return error('Enquiry not found.', 404);
    return json({ messages: await signedMessages(params.id) });
  }],
  'POST /api/enquiries/:id/messages': [async ({ params, body }) => {
    const thread = await getThread(params.id);
    if (!thread) return error('Enquiry not found.', 404);
    const input = (body || {}) as { text?: string; attachment?: { data: string; mimeType: string } };
    try { return json(await addMessage(params.id, 'visitor', input.text || '', input.attachment)); }
    catch (e) { return error(e instanceof Error ? e.message : 'Could not send message.', 400); }
  }],
  'GET /api/admin/enquiries': admin.concat([async () => {
    const { items } = await db.list('enquiry_threads', { limit: 200 });
    return json({ threads: items.sort((a: any,b: any) => b.updatedAt-a.updatedAt) });
  }]),
  'GET /api/admin/enquiries/:id/messages': admin.concat([async ({ params }) => {
    const thread = await getThread(params.id);
    if (!thread) return error('Enquiry not found.', 404);
    return json({ messages: await signedMessages(params.id) });
  }]),
  'POST /api/admin/enquiries/:id/messages': admin.concat([async ({ params, body }) => {
    const thread = await getThread(params.id);
    if (!thread) return error('Enquiry not found.', 404);
    const input = (body || {}) as { text?: string; attachment?: { data: string; mimeType: string } };
    try { return json(await addMessage(params.id, 'admin', input.text || '', input.attachment)); }
    catch (e) { return error(e instanceof Error ? e.message : 'Could not send reply.', 400); }
  }]),
  'POST /api/admin/generate-vehicle-image': admin.concat([async ({ body }) => {
    const input = (body || {}) as { prompt?: string };
    const prompt = (input.prompt || 'Photorealistic premium electric vehicle editorial photograph, modern automotive studio, no logos, no text, no fake brand badge.').slice(0,1200);
    const generated = await ai.imageGen({ prompt, maxOutputBytes: 900000 });
    const path = 'generated/vehicle-' + now() + '.png';
    const [ok] = await storage.write([{ path, content: generated.image.data, contentType: generated.image.mimeType || 'image/png' }]);
    if (!ok) return error('Generated image could not be saved.', 500);
    const note = 'AI-generated concept image; not a photograph of a specific production vehicle.';
    const [recordId] = await db.add('generated_vehicle_images', [{ path, label: 'AI vehicle concept', note, createdAt: now() }]);
    const [asset] = await storage.url([path]);
    return json({ id: recordId, path, url: asset.url, note });
  }])
});
