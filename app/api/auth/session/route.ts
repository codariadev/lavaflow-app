import { adminAuth, adminDb } from "@/app/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { idToken, role: requestedRole, name, empresaId } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Token não fornecido." }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();

    let finalRole = "cliente";

    if (userDoc.exists) {
      if (requestedRole) {
        finalRole = requestedRole;
        await userRef.update({
          role: requestedRole,
          name: name || userDoc.data()?.name || "",
          empresaId: requestedRole === "adm" ? (empresaId || uid) : null,
          updatedAt: new Date().toISOString(),
        });
      } else {
        finalRole = userDoc.data()?.role || "cliente";
      }
    } else {
      finalRole = requestedRole || "cliente";
      await userRef.set(
        {
          name: name || decodedToken.name || "",
          email: decodedToken.email || "",
          role: finalRole,
          empresaId: finalRole === "adm" ? uid : null,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    const expiresIn = 60 * 60 * 24 * 1 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });


    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true, role: finalRole });
  } catch (error: unknown) {
    console.error("Erro na autenticação via API:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Falha ao autenticar no servidor.";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}