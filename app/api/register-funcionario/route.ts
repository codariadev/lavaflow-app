import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido ou vazio.' },
        { status: 400 }
      );
    }

    const { email, password, name, telefone, empresaId } = body;

    if (!email || !password || !empresaId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes (email, senha ou empresaId).' },
        { status: 400 }
      );
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    await adminDb
      .collection('empresas')
      .doc(empresaId)
      .collection('users')
      .doc(userRecord.uid)
      .set({
        name,
        email,
        telefone: telefone || '',
        role: 'lavador',
        empresaId,
        createdAt: new Date().toISOString(),
      });

    await adminDb.collection('users').doc(userRecord.uid).set({
      name,
      email,
      empresaId,
      role: 'lavador',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: unknown) {
    console.error('Erro no registro do funcionário:', error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Erro interno ao processar o cadastro.';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}