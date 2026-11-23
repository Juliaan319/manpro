# Hasil verifikasi LabTrack

Dijalankan pada 1 November 2026 (WIB), Windows, Node.js 22.20.0, PostgreSQL 17 lokal di port 55432. Tidak menggunakan database mock untuk pengujian transaksi. Seed dan aktivitas browser adalah data pengembangan.

| Pemeriksaan | Hasil |
|---|---|
| ESLint | Lulus, tanpa error/peringatan |
| TypeScript `tsc --noEmit` | Lulus |
| Vitest | 30 pengujian lulus |
| Build produksi Next.js | Lulus |
| Playwright Chromium | 6 workflow lulus |
| npm audit | 0 kerentanan |
| Python `py_compile` | Lulus |
| Agent simulator → HTTP lokal terautentikasi → PostgreSQL | Lulus; sampel bertanda SIMULASI |
| Pembacaan CPU/RAM Python tanpa GPU NVIDIA | Lulus; metrik tidak didukung tidak menyebabkan crash |
| Tampilan desktop 1440px dan ponsel 390px | Ditinjau; tidak ada overflow horizontal dokumen, tabel dapat digulir |

## Cakupan 30 pengujian Vitest

- Pengajuan mahasiswa awal PENDING dan pending tidak memblokir pending lain.
- Persetujuan admin, penolakan beralasan, dan jejak audit.
- Persetujuan konkuren pada PC yang sama menghasilkan satu pemenang.
- Penulisan langsung database yang overlap ditolak constraint; interval bersebelahan diterima.
- Maintenance dicek saat pengajuan dan saat persetujuan.
- Pembatalan sendiri yang memenuhi syarat; pengajuan orang lain tidak dapat dibatalkan.
- Pengguna/kepala lab tidak dapat menyetujui; admin tidak dapat menyetujui milik sendiri.
- Pengajuan selesai tidak dapat diproses ulang; waktu lampau/interval tidak valid ditolak.
- Reservasi disetujui terhubung ke check-in, checkout menghitung menit server, dan reservasi menjadi selesai.
- Walk-in dan check-in bersamaan menjaga satu sesi aktif; reservasi orang lain ditolak.
- QR terikat PC, tanda tangan diubah ditolak, token kedaluwarsa ditolak.
- Koreksi lupa checkout tetap menyimpan waktu/durasi null dan log alasan.
- Checkout orang lain, bantuan oleh non-admin, dan mutasi kepala lab ditolak.
- Heartbeat usang/null offline; GPU null tidak menyebabkan kegagalan.
- Rahasia perangkat salah ditolak; sumber simulasi/fisik harus cocok kredensial.
- Query dan ekspor CSV/PDF memuat data laboratorium sesuai filter.
- Ekspor dan manajemen oleh pengguna biasa ditolak; Origin tidak sesuai ditolak.
- Registrasi publik tidak bisa menyisipkan role istimewa dan kata sandi benar-benar bcrypt.

## Cakupan enam workflow Playwright

1. Semua tiga peran login, membuka seluruh navigasi yang diizinkan, lalu logout.
2. Mahasiswa mengajukan dan membatalkan PC melalui form UI.
3. Walk-in masuk/keluar dan melihat durasi di riwayat.
4. Admin membuat/menghapus laboratorium dan menampilkan QR; kepala lab mengunduh CSV.
5. HTTP tanpa sesi, ekspor tanpa izin, dan pengalihan halaman admin untuk mahasiswa.
6. Screenshot desktop/mobile, pembukaan navigasi mobile, serta monitoring tanpa overflow dokumen.

## Verifikasi agen

Virtual environment dibuat di `agent/.venv` (tidak dilacak Git). Kredensial sementara jenis SIMULASI dibuat untuk AI-PC-03, agen dijalankan `--simulate --once`, lalu sampel diverifikasi melalui Prisma. Kredensial sementara dihapus setelah pengujian. Sampel tetap bertanda SIMULASI. Tidak ada klaim bahwa sampel tersebut berasal dari PC laboratorium Petra.

## Batas bukti

Belum diuji dengan GPU NVIDIA atau jaringan PC laboratorium Petra, SSO, kontrol akses fisik, atau deployment Vercel/Supabase produksi. Integrasi hardware memerlukan pemasangan agen dan kredensial resmi. Browser suite memakai database seed lokal. Tidak ada deployment publik yang dilakukan.

## Pembaruan Remote PC (16 November 2026)

Modul remote menggunakan surat PDF tersimpan dalam PostgreSQL, persetujuan berbasis peran, jadwal multi-hari, tautan petunjuk akses, dan status operasional REMOTE. Formulir bawaan memiliki field PDF yang dapat diisi dan identitas mahasiswa terisi dari akun. Admin dapat mengganti template dengan tautan HTTPS surat kampus.

Pengujian tambahan: unggahan PDF wajib/valid; isi dokumen tidak bocor pada API daftar; download hanya pemilik/admin; penolakan beralasan; pembatalan milik sendiri; pengajuan sendiri tidak dapat disetujui; persetujuan bersamaan antarsesama remote maupun remote melawan peminjaman lokal; database menolak konflik lintas tabel melalui trigger; status manual Terremote menolak permintaan baru; kepala lab tidak boleh bermutasi. Total suite unit/integrasi menjadi 63 pengujian.

Alur browser tambahan mengunduh formulir bawaan, mengisi PDF, mengunggah surat sebagai mahasiswa, mengunduh surat sebagai admin, menyetujui dengan tautan petunjuk, mengubah PC menjadi Terremote, dan memeriksa keputusan pada akun mahasiswa. Dataset pengujian terpisah dan dibersihkan setelah pengujian.

Akses desktop kampus belum diintegrasikan dan tidak dipasang otomatis oleh persetujuan. Operator menyiapkan layanan remote sesungguhnya dan dapat memberikan tautan petunjuk resminya. Status manual Terremote memerlukan pengembalian status oleh pengelola.

## Pembaruan QR cetak dan profil per akun

67 pengujian unit/integrasi dan 10 alur Playwright lulus. Tambahan bukti meliputi QR lab tanpa PC, penolakan token lab berbeda, QR cetak tetap valid melewati dua menit, pencabutan versi QR lama, dan pembaruan profil yang tidak dapat menargetkan akun lain. Browser menguji profil ketiga peran serta scan lab tiga kali melalui alternatif tautan pada pemindai web ketika izin kamera ditolak. Jam masuk pertama tetap, jam keluar terakhir diperbarui, dan hanya satu sesi harian dibuat.

Lint, TypeScript, dan build produksi lulus. Pemindaian optik kamera fisik serta cetakan kertas belum diuji dengan perangkat nyata; alur browser menggunakan tautan QR bertanda tangan dan simulasi penolakan izin kamera. Penggunaan kamera ponsel memerlukan HTTPS dan origin aplikasi yang dapat dijangkau perangkat tersebut.

## Penataan UI berdasarkan referensi Architect (16 November 2026)

Portal menggunakan sidebar berkelompok, header ringkas, tiga metrik, panel ketersediaan, tabel peminjaman/presensi, serta catatan audit. Halaman depan dan login menggunakan keterangan layanan langsung dengan foto lab yang sudah ada. Lint, typecheck, build produksi dan 10 alur browser lulus setelah restrukturisasi UI. Pemeriksaan Playwright tambahan pada dashboard, remote, profil, PC dan presensi tidak menemukan overflow horizontal pada lebar 390, 768, 1024 dan 1440px. Tangkapan layar desktop, ponsel, login dan profil diperiksa secara visual. Polesan warna tombol terakhir diverifikasi melalui build dan browser tersendiri.

## Presensi mahasiswa hanya QR (17 November 2026)

68 pengujian unit/integrasi dan 10 alur browser lulus, bersama lint dan build produksi. Pengujian API memastikan USER tanpa QR ditolak saat check-in dan checkout manual ditolak tanpa menutup sesi. Browser memastikan tombol Masuk laboratorium/Keluar tidak tersedia bagi mahasiswa dan dua scan QR bertanda tangan tetap mencatat masuk/keluar dengan durasi server. Pengujian bantuan check-in admin bersamaan tetap memastikan satu sesi aktif.

## Login Google mahasiswa (17 November 2026)

Migrasi User.googleSubject diterapkan. 83 unit/integration tests lulus, lint/TypeScript lulus, dan build produksi berhasil setelah peringatan versi framework. Sebelas alur browser telah lulus (sepuluh alur fitur dan satu pengujian login Google-only/sesi kata sandi lama). Percobaan pertama pengujian UI terakhir diperbaiki karena locator alert juga menemukan route announcer bawaan Next.js; pengujian tersebut lulus setelah locator diarahkan ke form login.

Tes integrasi Google memvalidasi email terverifikasi dan pola tepat, pemetaan ID database ke JWT/session, nama Google, reuse akun tanpa mengubah role, konflik subject, dan login bersamaan. Alur browser mahasiswa memakai sesi fixture yang ditandatangani khusus dalam proses pengujian; tidak menambahkan bypass pada aplikasi. Login Google end-to-end ke layanan Google belum diuji karena user belum membuat OAuth client. GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET pada .env disiapkan kosong, tombol Google nonaktif sampai konfigurasi asli diisi. Login kata sandi mahasiswa dan sesi lama ditolak, login pengelola tetap berhasil.

Panduan aktivasi lengkap tersedia di docs/GOOGLE-LOGIN.md. Build juga menampilkan peringatan bahwa versi Next.js terpasang terdampak kerentanan; pembaruan framework belum dilakukan dalam perubahan autentikasi ini.

## Konfigurasi Google dimuat dan tombol aktif (17 November 2026)

Kredensial Google lokal sudah diisi pengguna, kemudian aplikasi dibuild dan server dimulai ulang. Pemeriksaan browser menemukan tombol Google aktif, provider Google terdaftar (HTTP 200), dan pengalihan mencapai accounts.google.com dengan callback lokal yang benar, state, dan PKCE. Tidak terdeteksi invalid_client atau redirect_uri_mismatch pada halaman pengalihan yang diamati. Tidak melakukan login menggunakan akun Google pengguna, sehingga pertukaran authorization code dan login akun kampus sampai dashboard belum diverifikasi. Teks penjelasan domain/nama di bawah tombol dihapus atas permintaan pengguna; pembatasan backend tetap berlaku. Nilai Client ID/Secret tidak dicetak ke log verifikasi.

## Riwayat dan laporan terpadu (17 November 2026)

92 unit/integration tests dan 12 alur Playwright lulus, termasuk fixture laporan dengan dua pengunjung, empat sesi, rata-rata 90 menit, tiga jam penggunaan PC, dan dua sesi untuk ditinjau. Verifikasi mencakup pengalihan URL riwayat lama, satu menu laporan, tanggal grafik Oktober (bukan minggu terkini), filter tinjauan, ekspor sesuai pencarian, dan tanpa overflow horizontal di 390px. Tes unit menguji WIB, pengunjung berulang, nol menit valid, sesi aktif/koreksi/negatif yang tidak menambah durasi, kelompok tanggal maksimal 21, dan perangkat tanpa kunjungan. Ekspor CSV presensi serta peminjaman diuji untuk pencarian nama yang cocok dan hasil kosong. Alur browser laporan terkait diulang dan lulus setelah polesan pesan data kosong serta penghapusan alasan tinjauan yang sempat tampil dua kali.

Lint, TypeScript, dan build produksi berhasil. Peringatan keamanan versi Next.js yang tercatat sebelumnya masih muncul; perubahan ini tidak menaikkan versi framework.
