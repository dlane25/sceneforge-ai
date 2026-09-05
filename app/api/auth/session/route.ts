import { NextResponse } from 'next/server';
import { optionalUser } from '@/lib/auth';

export async function GET() { return NextResponse.json({ data: await optionalUser() }); }
