// Supabase Edge Function: identifies a two-wheeler spare part from a photo using Claude vision.
// The API key stays on the server: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy: supabase functions deploy identify-part

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { image, mediaType, vocabulary } = await req.json();
    if (!image) throw new Error('No image supplied');

    const prompt =
      'You identify Indian two-wheeler (motorcycle/scooter) spare parts from photos. ' +
      'Reply with ONLY compact JSON: {"part_name": string, "keywords": string[]} where keywords are 2-5 lowercase ' +
      'words a shop database might use (part type, e.g. "brake shoe", "clutch plate", "chain sprocket"). ' +
      (vocabulary ? `Prefer terms from this shop vocabulary when they fit: ${String(vocabulary).slice(0, 1500)}. ` : '') +
      'If it is not a vehicle part, return {"part_name":"unknown","keywords":[]}.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5', // cheapest tier — plenty for part identification
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Vision service error (${res.status})`);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? '{}';
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return new Response(JSON.stringify(json), { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }
});
