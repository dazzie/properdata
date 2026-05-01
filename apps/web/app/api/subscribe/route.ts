import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const sql = getSql();

  try {
    await sql(
      `INSERT INTO subscribers (email, tier, status)
       VALUES ($1, 'free', 'active')
       ON CONFLICT (email) DO NOTHING`,
      [email],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Subscribe failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
