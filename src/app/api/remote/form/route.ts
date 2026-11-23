import { actor } from "@/lib/auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export async function GET() {
  try {
    const u = await actor();
    const pdf = await PDFDocument.create(),
      page = pdf.addPage([595, 842]),
      font = await pdf.embedFont(StandardFonts.Helvetica),
      form = pdf.getForm();
    page.drawText("LABTRACK - PERMOHONAN REMOTE PC", {
      x: 40,
      y: 795,
      size: 17,
      font,
    });
    page.drawText("Universitas Kristen Petra / Laboratorium AI", {
      x: 40,
      y: 772,
      size: 11,
      font,
    });
    page.drawText("Lengkapi, simpan PDF, dan unggah melalui menu Remote PC.", {
      x: 40,
      y: 744,
      size: 10,
      font,
    });
    const fields = [
      ["nama", "Nama lengkap", u.name],
      ["nrp", "NRP", u.identity || ""],
      ["email", "Email Petra", u.email],
      ["pc", "Kode PC", ""],
      ["mulai", "Tanggal dan waktu mulai (WIB)", ""],
      ["selesai", "Tanggal dan waktu selesai (WIB)", ""],
    ];
    let y = 705;
    for (const [name, label, value] of fields) {
      page.drawText(label, { x: 40, y, size: 10, font });
      const f = form.createTextField(name);
      f.setText(value.replace(/[^\x20-\x7E]/g, ""));
      f.addToPage(page, {
        x: 40,
        y: y - 33,
        width: 515,
        height: 25,
        borderColor: rgb(0.75, 0.75, 0.8),
        borderWidth: 1,
      });
      y -= 64;
    }
    page.drawText("Tujuan penggunaan dan kebutuhan komputasi", {
      x: 40,
      y,
      size: 10,
      font,
    });
    const purpose = form.createTextField("tujuan");
    purpose.enableMultiline();
    purpose.addToPage(page, {
      x: 40,
      y: y - 80,
      width: 515,
      height: 70,
      borderWidth: 1,
      borderColor: rgb(0.75, 0.75, 0.8),
    });
    y -= 110;
    for (const text of [
      "Saya mengajukan penggunaan sesuai tujuan di atas dan akan mematuhi",
      "ketentuan laboratorium serta menjaga keamanan akun akses remote.",
    ]) {
      page.drawText(text, { x: 40, y, size: 10, font });
      y -= 16;
    }
    page.drawText(
      "Tanggal / tanda tangan pemohon (dapat ditandatangani setelah dicetak):",
      { x: 40, y: y - 10, size: 10, font },
    );
    const sign = form.createTextField("tanggal_tanda_tangan");
    sign.addToPage(page, {
      x: 40,
      y: y - 70,
      width: 515,
      height: 45,
      borderWidth: 1,
      borderColor: rgb(0.75, 0.75, 0.8),
    });
    page.drawText(
      "Surat ini belum merupakan persetujuan. Keputusan dicatat melalui LabTrack.",
      { x: 40, y: 40, size: 9, font },
    );
    form.updateFieldAppearances(font);
    return new Response(Buffer.from(await pdf.save()), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="formulir-remote-labtrack.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Silakan masuk terlebih dahulu.", { status: 401 });
  }
}
