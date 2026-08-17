export default {
  async fetch(request) {
    const imageUrl = 'https://bulltrace.app/og-image-v2.png';
    const response = await fetch(imageUrl);
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};
