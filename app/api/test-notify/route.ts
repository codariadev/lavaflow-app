// app/api/test-notify/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { veiculo } = await req.json();

  return NextResponse.json({
    success: true,
    title: 'Sua lavação foi concluída! 🚗✨',
    body: `O veículo ${veiculo || 'Civic Preto'} está pronto para ser retirado.`,
  });
}