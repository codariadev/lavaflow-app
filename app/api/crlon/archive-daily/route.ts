import { NextResponse } from 'next/server';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Não autorizado', { status: 401 });
  }

  try {
    const hojeStr = new Date().toISOString().split('T')[0];
    const agendamentosRef = collection(db, 'agendamentos');

    const q = query(agendamentosRef, where('date', '<=', hojeStr));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    let processadosCount = 0;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const status = data.status;
      const dataAgendamento = data.date;

      if (status === 'concluido' || status === 'cancelado') {
        const historicoRef = doc(
          collection(db, `historico_diario/${dataAgendamento || hojeStr}/servicos`),
          docSnap.id
        );

        batch.set(historicoRef, {
          ...data,
          arquivadoEm: new Date().toISOString(),
        });

        batch.delete(docSnap.ref);
        processadosCount++;
      }
    });

    if (processadosCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `Arquivamento concluído com sucesso. ${processadosCount} itens movidos para o histórico.`,
    });
  } catch (error) {
    console.error('Erro no arquivamento diário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar arquivamento' },
      { status: 500 }
    );
  }
}