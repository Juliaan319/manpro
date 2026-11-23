import "./globals.css";
import "./portal.css";
import { Toaster } from "sonner";
export const metadata = {
  title: "LabTrack | Universitas Kristen Petra",
  description: "Sistem presensi dan pemantauan laboratorium AI dan VR",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
