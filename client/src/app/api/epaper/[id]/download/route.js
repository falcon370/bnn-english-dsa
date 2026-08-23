const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export async function GET(_req, { params }) {
  const { id } = await params;
  const upstream = await fetch(`${API_BASE}/api/epaper/${id}/download`);

  if (!upstream.ok) {
    return new Response('PDF not found', { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="epaper-${id}.pdf"`,
    },
  });
}
