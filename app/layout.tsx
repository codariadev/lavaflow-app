import NotificationGuard from "./components/NotificationGuard";
import TelefoneGuard from "./components/TelefoneGuard";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <NotificationGuard>
          <TelefoneGuard>{children}</TelefoneGuard>
        </NotificationGuard>
      </body>
    </html>
  );
}
