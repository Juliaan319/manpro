# LabTrack

**Kebijakan akses terbaru:** pendaftaran dan akses akun USER hanya untuk mahasiswa dengan email `c14` diikuti angka pada domain persis `john.petra.ac.id`. NRP diambil dari email. Akun LAB_ADMIN/HEAD_LAB hanya diprovision pengelola dan tetap dapat masuk. Pemeriksaan berlaku saat login dan setiap operasi yang membaca sesi. Pemeriksaan format belum memverifikasi kepemilikan email; tidak ada SSO/OTP universitas yang terhubung. Ketentuan ini menggantikan penjelasan registrasi pengunjung/dosen/staf pada dokumentasi awal di bawah.


Sistem Informasi Presensi dan Pemantauan Laboratorium Artificial Intelligence (AI) dan Virtual Reality (VR) Berbasis Web untuk Universitas Kristen Petra, Surabaya. Implementasi proyek Oktober–Desember 2026. Antarmuka berbahasa Indonesia; seluruh waktu antarmuka dan laporan menggunakan Asia/Jakarta (WIB).

## Arsitektur

Next.js App Router dan React/TypeScript menyajikan halaman server yang dilindungi autentikasi serta komponen klien untuk interaksi, kalender, grafik Recharts, dialog native, React Hook Form, dan notifikasi Sonner. Route handlers memvalidasi masukan melalui Zod, membaca peran terbaru dari database, lalu memanggil layanan bisnis Prisma/PostgreSQL. Tailwind CSS 4 dan stylesheet bersama mengatur tampilan responsif.

Auth.js/NextAuth credentials menggunakan akun database dan bcrypt cost 12. Sesi berupa JWT HttpOnly dengan masa berlaku delapan jam; identitas sesi digunakan untuk mengambil akun/peran terkini pada setiap operasi server. Registrasi publik tidak menerima peran istimewa. Administrator dapat membuat pengguna termasuk admin lain; kepala laboratorium membaca monitoring dan laporan, serta mengubah profilnya sendiri.

Agen Python yang dipasang eksplisit mengirim metrik melalui HTTPS ke `/api/telemetry`, menggunakan rahasia per perangkat yang hanya disimpan sebagai SHA-256 pada server. Kredensial memisahkan sumber fisik dan SIMULASI. Dashboard mengambil pembaruan setiap 20 detik; heartbeat berusia 60 detik dianggap offline. Status konektivitas tidak menentukan ketersediaan fisik.

## Persyaratan

- Node.js 22 LTS atau versi kompatibel Next.js 16; npm.
- PostgreSQL 17 atau PostgreSQL/Supabase kompatibel, dengan ekstensi `btree_gist`.
- Python 3.11+ untuk agen opsional.
- Browser modern. Tidak memerlukan scanner, webcam, SSO, atau perangkat keras untuk menguji workflow.

## Instalasi Windows 11 (PowerShell)

```powershell
cd C:\MANPRO
npm ci
Copy-Item .env.example .env
# Edit .env sesuai database Anda dan buat dua rahasia acak independen:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Isi `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, dan `QR_SECRET`. Jangan commit `.env`. Untuk PostgreSQL lokal yang sudah Anda miliki, contoh:

```dotenv
DATABASE_URL="postgresql://labtrack:PASSWORD@127.0.0.1:5432/labtrack?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="RAHASIA_ACAK_PERTAMA"
QR_SECRET="RAHASIA_ACAK_KEDUA"
```

Alternatif pengembangan terisolasi jika PostgreSQL 17 terpasang di lokasi default:

```powershell
.\scripts\start-local-db.ps1
# Isi DATABASE_URL di .env sesuai konfigurasi PostgreSQL lokal Anda.
# Opsional, lokasi PostgreSQL lain:
# .\scripts\start-local-db.ps1 -PostgresBin 'D:\PostgreSQL\17\bin'
```

Script membuat cluster khusus di `.local/postgres`, bind hanya `127.0.0.1`, port 55432. Cluster memakai trust untuk pengembangan lokal; jangan gunakan konfigurasi ini di server produksi. Script tidak mengubah layanan PostgreSQL sistem. Hentikan dengan `.\scripts\stop-local-db.ps1`. Aplikasi dan database terisolasi pada workspace ini telah dikonfigurasi untuk pengujian lokal.

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Akun demo terpisah di [docs/DEVELOPMENT-ACCOUNTS.md](docs/DEVELOPMENT-ACCOUNTS.md). Untuk menjalankan hasil build:

```powershell
npm run build
npm start
```

## PostgreSQL / Supabase

Gunakan connection string database yang diberikan operator/provider, dengan password URL-encoded dan TLS yang disyaratkan provider, misalnya `?sslmode=require`. Untuk migrasi, gunakan koneksi langsung atau session pooler yang mendukung DDL; jangan memakai transaction pooler untuk perintah migrasi. Jalankan `npm run db:migrate` dengan DATABASE_URL koneksi migrasi, lalu atur DATABASE_URL aplikasi ke koneksi deployment yang sesuai. Tidak ada kredensial Supabase yang diciptakan aplikasi.

Migrasi kedua menjalankan `CREATE EXTENSION IF NOT EXISTS btree_gist`. Bila role migrasi tidak diberi izin membuat ekstensi, minta operator database mengaktifkannya sebelum migrasi. Constraint PostgreSQL tidak boleh dihilangkan untuk mengatasi masalah izin. `prisma db push` tidak menggantikan migrasi SQL khusus ini.

## Workflow

1. Pengguna mendaftar dengan jenis Mahasiswa/Dosen/Staf/Pengunjung eksternal. Internal memerlukan NRP/NIP unik; eksternal memerlukan institusi.
2. Peminjaman PC: pilih lab dan PC, tanggal/waktu WIB, serta tujuan. Kalender menampilkan slot mulai pukul 07–19 WIB; formulir mendukung waktu di luar rentang visual kalender.
3. Pengajuan tersimpan PENDING. Pending lain tidak memblokir slot. Admin meninjau konflik dan menyetujui atau menolak dengan alasan. Admin tidak boleh meninjau pengajuan sendiri.
4. Reservasi APPROVED memblokir slot. Pengajuan sendiri yang belum mulai dan belum digunakan dapat dibatalkan. Pengajuan berakhir tanpa presensi menjadi EXPIRED ketika data diperbarui.
5. Presensi mendukung walk-in tanpa PC, reservasi disetujui yang sedang berlaku, QR PC, serta bantuan admin bagi pengguna lain. Hanya satu sesi aktif per pengguna dan per PC.
6. Checkout normal memakai waktu server dan menghitung menit penuh. Koreksi admin menutup sesi sebagai CORRECTED dengan alasan audit; waktu keluar dan durasi tetap null karena tidak diketahui. Durasi tidak diketahui tidak dimasukkan ke total durasi tercatat.
7. Data yang memiliki riwayat tidak dapat dihapus karena foreign key. Gunakan status tidak aktif/tidak tersedia untuk mempertahankan histori.

## Integritas jadwal dan keamanan

`src/lib/service.ts` adalah sumber aturan bisnis. Persetujuan dan pembatalan mengunci baris PC dengan `SELECT ... FOR UPDATE`; persetujuan memeriksa status, peran, kepemilikan, operasional, dan overlap kembali di dalam transaksi. Selain pemeriksaan aplikasi, exclusion constraint GiST menolak interval `[startAt,endAt)` APPROVED yang overlap pada PC sama. Slot bersebelahan diperbolehkan. Partial unique indexes mencegah dua presensi ACTIVE untuk pengguna atau PC sama. Check constraint memaksa endAt > startAt.

Semua operasi pengelolaan memeriksa peran di server. API data pengguna biasa dibatasi userId; kalender lintas pengguna hanya berisi identitas PC dan slot waktu tanpa nama/tujuan pengguna lain. Kata sandi, hash, dan rahasia perangkat tidak dikirim lewat API data. Mutasi browser memeriksa Origin. Auth.js menyediakan proteksi CSRF autentikasi. Login, registrasi, mutasi, dan ingestion dibatasi melalui counter PostgreSQL bersama sehingga pembatasan tidak bergantung memori satu instance. Log audit memuat persetujuan, penolakan, pengelolaan, bantuan check-in, rotasi kredensial, dan koreksi.

## QR check-in

Administrator membuka Data PC → Kode QR. Tersedia halaman tampilan khusus `/display/[pcId]` melalui tautan di dialog. Token ditandatangani HMAC-SHA256, terikat PC, berlaku dua menit, dan diperbarui tiap 90 detik. Ponsel membuka `/checkin?token=...`; jika belum login, callback mempertahankan token. Server tetap memvalidasi tanda tangan, kedaluwarsa, PC/lab, kepemilikan, dan jadwal reservasi saat submit. QR dapat dipakai beberapa pengguna selama masa berlaku tetapi constraint sesi mencegah penggunaan PC bersamaan.

Untuk ponsel sungguhan, NEXTAUTH_URL harus URL HTTPS yang dapat diakses ponsel. `localhost` pada ponsel mengarah ke ponsel, bukan PC. QR menunjukkan PC yang dikodekan; tanpa sistem akses fisik universitas, QR tidak membuktikan keberadaan fisik secara mutlak. Tidak ada integrasi Petra Mobile/SSO.

## Monitoring dan simulator

Lihat [agent/README.md](agent/README.md) untuk instalasi, konfigurasi, HTTPS, sumber data, dan keterbatasan NVIDIA. Admin membuat kredensial melalui tombol Agen pada PC. Gunakan sumber SIMULASI untuk pengembangan dan mode `--simulate`; backend menolak mode yang tidak cocok. Tidak ada rahasia agen bawaan atau pengiriman data simulasi yang disamarkan sebagai perangkat asli.

```powershell
python -m venv agent\.venv
agent\.venv\Scripts\python -m pip install -r agent\requirements.txt
Copy-Item agent\.env.example agent\.env
# Edit URL, PC_ID, DEVICE_SECRET, dan interval.
agent\.venv\Scripts\python agent\agent.py --simulate
```

## Database

| Entitas | Isi / relasi penting |
|---|---|
| User | Akun unik email dan NRP/NIP opsional, bcrypt, role, jenis pengguna; pemilik pengajuan dan presensi, reviewer, aktor audit |
| Laboratory | Kode unik, nama, lokasi, deskripsi, aktif; memiliki PC, reservasi, presensi |
| PC | Kode unik, lab, spesifikasi, operasional, kemampuan monitoring, heartbeat; memiliki kredensial dan telemetri |
| PCBorrowRequest | Pengguna, lab, PC, interval UTC, tujuan, status, reviewer, alasan, timestamps; satu presensi opsional |
| AttendanceSession | Pengguna/lab, PC/reservasi opsional, masuk/keluar, menit, status, alasan koreksi |
| PCTelemetry | Sampel bertimestamp server, metrik nullable, sumber SIMULASI/fisik; indeks PC dan waktu |
| DeviceCredential | Satu kredensial aktif per PC, hash rahasia, sumber data; rotasi mengganti kredensial |
| AuditLog | Aktor, tindakan, entityId, alasan, waktu; catatan administratif |
| RateLimit | Counter atomik per identitas/window di PostgreSQL |

Prisma menyimpan tanggal secara konsisten dari objek Date UTC. Kolom interval reservasi memakai `timestamptz` untuk exclusion constraint. Tampilan/filter memakai WIB; masukan waktu lokal diubah dengan offset +07:00, bukan timezone browser.

## Dashboard dan laporan

Dasbor menampilkan pengguna, lab, PC tersedia/dipesan/digunakan, pending, sesi aktif, selesai, durasi, grafik kunjungan AI/VR, pengajuan bulanan, distribusi status, perbandingan dua minggu, konektivitas, dan ringkasan GPU. Data awal diberi deskripsi demo. Nilai metrik kosong bukan nol.

Admin/kepala lab dapat memfilter laboratorium, tanggal, PC, jenis pengguna, dan status reservasi di Laporan/Riwayat. Laporan mencakup presensi, pengajuan, peminjaman selesai melalui filter status, durasi, ringkasan per PC, serta periode harian/bulanan. Unduh CSV kompatibel Excel atau PDF untuk presensi maupun peminjaman. Ekspor menggunakan query database terfilter di server, bukan data tampilan buatan. CSV menyertakan BOM UTF-8 dan proteksi formula. PDF berhalaman menggunakan font standar; karakter di luar ASCII diganti spasi agar font standar tidak gagal. Gunakan CSV untuk mempertahankan nama Unicode lengkap.

## Pengujian

Gunakan database pengembangan terpisah dari produksi. Suite membuat fixture bernama unik dan membersihkannya; browser menggunakan seed dan dapat menambah riwayat uji yang ditandai jelas.

```powershell
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run build
npm run test:e2e
python -m py_compile agent\agent.py
npm audit
```

Vitest menguji aturan dan transaksi terhadap PostgreSQL nyata: persetujuan bersamaan, constraint overlap, pembatalan, kepemilikan, maintenance, sesi bersamaan, QR, koreksi, autentikasi telemetri, GPU null, filter/ekspor, dan RBAC. Playwright menjalankan browser Chromium pada build produksi: login semua role, semua navigasi, permintaan/batal, presensi, CRUD lab, QR, ekspor kepala lab, pembatasan HTTP, dan viewport desktop/ponsel. Konfigurasi Playwright memulai `npm start` jika server belum aktif. Lihat [docs/VERIFICATION.md](docs/VERIFICATION.md) untuk hasil aktual.

## Deployment

1. Buat PostgreSQL produksi dan aktifkan btree_gist melalui operator berwenang.
2. Atur DATABASE_URL dan dua rahasia acak independen; NEXTAUTH_URL harus origin HTTPS deployment.
3. Jalankan migrasi melalui koneksi DDL yang sesuai. Jangan jalankan seed demo.
4. Deploy ke Vercel menggunakan build command `npm run build`; atau host Node menggunakan `npm run build` dan `npm start`.
5. Provision administrator pertama dengan `npm run admin:create` (lihat di bawah), kemudian kelola akun dari UI. Instal agen secara eksplisit di PC, buat kredensial per perangkat, dan gunakan HTTPS.
6. Atur backup database dan kebijakan retensi. PCTelemetry adalah time series tanpa penghapusan otomatis agar riwayat tidak hilang; operator perlu menentukan dan menjalankan retensi yang sesuai. RateLimit lama dapat dibersihkan berkala. Tidak ada proses background permanen pada Vercel; expiry dicek ketika data dibaca.

```powershell
# Jalankan hanya oleh operator pada environment database yang benar.
$env:ADMIN_NAME='Nama Administrator'
$env:ADMIN_EMAIL='admin@domain-universitas.ac.id'
$env:ADMIN_PASSWORD='KATA_SANDI_ACAK_YANG_KUAT'
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

Script hanya membuat akun baru dan tidak mengganti akun yang sudah ada. Rahasia produksi tidak dicetak. Tidak ada deployment publik otomatis pada pekerjaan ini.

## Struktur direktori

```text
agent/                 Agen Python, konfigurasi contoh, dokumentasi
prisma/schema.prisma   Model database
prisma/migrations/     Migrasi awal dan constraint PostgreSQL
prisma/seed.ts         Data pengembangan
scripts/               Provisioning admin dan PostgreSQL lokal
src/app/               Halaman App Router dan API
src/components/        Ruang kerja, autentikasi, analitik, QR
src/lib/               Prisma, auth, validasi, layanan bisnis, QR
src/types/             Tipe sesi
 tests/                Suite integrasi PostgreSQL (Vitest)
e2e/                   Workflow browser (Playwright)
docs/                  Akun demo dan bukti verifikasi
.env.example           Template konfigurasi tanpa rahasia
```

## Batas integrasi

Telemetri fisik memerlukan PC laboratorium, pemasangan agen, driver NVIDIA yang sesuai, dan koneksi jaringan. Data contoh spesifikasi/lokasi harus diverifikasi operator. GPU non-NVIDIA menghasilkan metrik GPU tidak tersedia, tetapi heartbeat/CPU/RAM tetap berjalan. Agen membaca GPU NVIDIA pertama. SSO/Petra Mobile, kontrol pintu, dan bukti kehadiran fisik belum diintegrasikan karena akses resmi belum diberikan. Sistem tidak menyediakan remote desktop atau arbitrary remote command execution.
## Presensi harian (pembaruan)

Satu sesi per mahasiswa per laboratorium per tanggal Asia/Jakarta. Scan QR pertama membuat sesi aktif dan menetapkan jam masuk. Scan kedua menutup sesi; scan berikutnya memperbarui jam keluar terakhir tanpa mengubah jam masuk atau membuat baris baru. Durasi selalu dihitung server dari kedua timestamp. Reservasi yang terkait diselesaikan saat checkout. QR tetap harus valid dan cocok dengan lab/PC sesi. Sesi yang dikoreksi admin tidak ditimpa oleh scan.

Setiap pembukaan tautan `/checkin` memperoleh identitas kunjungan baru agar pemindaian ulang QR yang sama dapat membuka konfirmasi kembali. Membuka tautan saja tidak mengubah presensi; mahasiswa harus autentikasi dan mengonfirmasi. Waktu masuk/keluar yang tersimpan adalah waktu konfirmasi diterima server. Mutasi diproses dengan kunci baris pengguna/sesi dan unique key `(userId,laboratoryId,attendanceDay)`. Riwayat lama tidak dihapus atau direkayasa ulang.

Inventaris AI sekarang 10 PC, AI-PC-01 sampai AI-PC-10. Script `npx tsx scripts/sync-ai-inventory.ts` idempoten dan mempertahankan PC yang sudah ada. PC tambahan belum memiliki spesifikasi/kesiapan terverifikasi dan berstatus UNAVAILABLE sampai diaktifkan administrator. Dua PC VR tidak berubah.


### Inventaris dan peminjaman PC terbaru

AI-PC-01 sampai AI-PC-10 menggunakan spesifikasi yang sama dengan catatan AI-PC-01. Sinkronisasi `npx tsx scripts/sync-ai-inventory.ts` menyamakan CPU, RAM, GPU, dan VRAM, tanpa mengubah status operasional, heartbeat, atau kredensial perangkat. Nilai spesifikasi mengikuti data yang sudah tersimpan; belum merupakan verifikasi perangkat fisik.

Laboratorium VR tidak tersedia untuk peminjaman PC: disembunyikan dari katalog, kalender, filter, dan formulir peminjaman. Backend menolak pengajuan dan persetujuan baru untuk PC VR. Data laboratorium VR, monitoring, presensi, serta riwayat lama tetap dipertahankan.

## Remote PC multi-hari

Menu **Remote PC** tersedia untuk mahasiswa, administrator, dan kepala lab (baca saja). Mahasiswa mengunduh formulir PDF yang dapat diisi atau membuka tautan surat kampus yang dipasang admin, melengkapi surat, lalu mengunggah PDF maksimal 5 MB bersama pilihan PC, waktu mulai/selesai WIB, dan tujuan. Surat wajib ada sebelum pengajuan dibuat. Format dokumen yang diterima saat ini PDF; Google Docs/Word harus diekspor ke PDF terlebih dahulu.

Pengajuan awal PENDING. Hanya LAB_ADMIN dapat menyetujui atau menolak; penolakan wajib beralasan dan pengajuan sendiri tidak dapat disetujui. Admin dapat memasang tautan HTTPS untuk petunjuk/layanan remote yang resmi. Mahasiswa dapat melihat keputusan, alasan penolakan, dan tautan akses pada pengajuan miliknya. Pembatalan sendiri hanya diperbolehkan sebelum jadwal dimulai. Pengajuan pending yang berakhir menjadi EXPIRED; pengajuan disetujui yang berakhir menjadi COMPLETED ketika data diperbarui.

Surat disimpan sebagai bytea pada PostgreSQL bersama RemoteRequest, sehingga tidak bergantung direktori upload lokal atau filesystem sementara Vercel. API daftar tidak mengirim isi surat. Endpoint download memeriksa pemilik atau LAB_ADMIN dan mengirim attachment dengan Cache-Control no-store. Kepala lab tidak memiliki akses unduh surat mahasiswa. Batas payload penyedia hosting tetap berlaku; gunakan PDF kecil untuk deployment dengan batas request lebih rendah dari 5 MB.

Tabel RemoteRequest menyimpan pengaju, PC, interval, tujuan, status, reviewer, alasan, tautan akses, nama/isi PDF dan timestamps. RemotePolicy menyimpan tautan template opsional; kosong berarti formulir PDF bawaan. Migasi menambah PCStatus.REMOTE, constraint interval/file, exclusion constraint antarremote, dan trigger konflik lintas RemoteRequest/PCBorrowRequest. Semua persetujuan juga mengunci baris PC serta memeriksa jadwal kembali dalam transaksi.

PC otomatis ditampilkan **Terremote** selama jadwal remote APPROVED sedang berlaku. Administrator juga dapat memilih status operasional manual Terremote/Tidak tersedia melalui Data PC. Status manual tidak berakhir otomatis dan harus dikembalikan pengelola. Persetujuan remote tidak memasang agen desktop, membuka RDP, atau mengeksekusi perintah. Akses desktop memerlukan layanan remote kampus yang disiapkan operator; jangan menaruh kata sandi pada tautan akses.

## Satu portal login dan akun yang disediakan pengelola

Semua peran masuk melalui `/login` dengan tampilan Masuk LabTrack yang sama. Peran diambil dari User.role pada database; email c14 tidak otomatis memberikan hak admin. Akun admin dapat memakai email mahasiswa jika administrator/operator memberikan role LAB_ADMIN. Kepala lab menggunakan akun HEAD_LAB yang telah diprovision. `/admin` dan `/mahasiswa` dipertahankan sebagai alias yang menuju login yang sama atau dashboard akun yang sudah masuk.

Pendaftaran umum ditutup: `/register` mengarahkan ke `/login` dan POST `/api/register` menolak dengan HTTP 403 tanpa membuat akun. Akun baru disediakan pengelola lewat menu Pengguna, atau bootstrap admin oleh operator. Pemeriksaan email mahasiswa tetap berlaku untuk akun USER. Langkah/tombol buat akun di halaman publik dan tautan daftar di login dihapus. Panduan publik sekarang dua langkah.


Spesifikasi AI terbaru mengikuti informasi pengguna: 10 PC identik dengan AMD Ryzen 9 5900X 12-Core Processor, RAM 32 GB, NVIDIA GeForce RTX 3070. VRAM belum dikonfirmasi dan tidak memakai nilai demo 24 GB. Tombol provisioning Agen di kartu PC dihapus; Kode QR tetap tersedia untuk presensi harian.

## QR laboratorium cetak dan profil per akun (16 November 2026)

QR presensi baru berada di menu Laboratorium, bukan pada kartu PC. Administrator memilih **QR presensi lab**, membuka **tampilan cetak**, lalu mencetak dan menempelkan QR di laboratorium. Token ditandatangani dan terikat pada laboratorium serta versi QR. QR cetak tidak kedaluwarsa dua menit; berlaku sampai administrator memilih **Ganti QR laboratorium**. Setelah diganti, QR versi lama ditolak server dan cetakan harus diperbarui. Endpoint pembuatan QR PC lama tidak lagi tersedia; tautan tampilan PC lama diarahkan ke laboratoriumnya.

Mahasiswa masuk melalui portal yang sama, membuka Presensi, memilih **Pindai QR laboratorium**, mengizinkan kamera, lalu mengonfirmasi presensi. Kamera ponsel bawaan juga dapat membuka tautan QR tersebut. Pemindai web menerima tautan /checkin dari origin aplikasi yang sama. Kamera memerlukan HTTPS atau localhost; untuk digunakan melalui ponsel, NEXTAUTH_URL harus memakai alamat aplikasi yang dapat diakses ponsel, bukan localhost komputer. QR tidak menyimpan identitas mahasiswa. Akun yang sedang masuk menentukan pemilik sesi.

Satu sesi per akun per laboratorium per hari WIB: konfirmasi pertama mencatat masuk, kedua mencatat keluar, dan berikutnya memperbarui keluar terakhir dengan mempertahankan masuk pertama. Pemindaian tanpa konfirmasi tidak mengubah data. Presensi laboratorium dapat dilakukan tanpa memilih PC; reservasi aktif milik mahasiswa dapat ditautkan bila sesuai.

Profil mahasiswa, administrator, dan kepala lab memiliki identitas serta pintasan sesuai peran. Data profil selalu milik akun yang sedang masuk. Perubahan nama/institusi tidak dapat diarahkan ke akun lain melalui ID kiriman browser. Spesifikasi seluruh 10 PC AI adalah AMD Ryzen 9 5900X 12-Core Processor, RAM 32 GB, NVIDIA GeForce RTX 3070; informasi sebelumnya tentang spesifikasi demo telah digantikan.

## Presensi mahasiswa hanya melalui QR (17 November 2026)

Akun USER tidak memiliki tombol masuk/keluar manual. Tombol reservasi yang sedang berlaku mengarah ke pemindai presensi; tindakan keluar pada sesi sendiri juga mengarah ke halaman scan. Mahasiswa masuk dan keluar dengan memindai QR laboratorium lalu mengonfirmasi. Layanan checkin menolak USER tanpa QR valid; layanan checkout manual menolak USER. LAB_ADMIN tetap dapat membantu check-in dan mengoreksi sesi dengan alasan. Kepala lab tidak memiliki tombol mutasi presensi.

Pembatasan berlaku pada backend, bukan hanya tampilan. Aturan sesi harian tetap: masuk pertama, keluar terakhir, satu akun per lab per hari WIB.

## Login Google mahasiswa (17 November 2026)

Mahasiswa hanya menggunakan Google dengan email c14 diikuti angka dan domain persis @john.petra.ac.id. Email harus terverifikasi Google. Nama akun diambil dari profil Google dan disinkronkan setiap login; perubahan nama manual mahasiswa ditutup. Akun baru otomatis USER/STUDENT; akun dengan email sama memakai ID dan riwayat lama tanpa perubahan role. Identitas provider diikat dengan User.googleSubject yang unik.

Login kata sandi hanya untuk LAB_ADMIN dan HEAD_LAB. Sesi USER dari login kata sandi lama ditolak. OAuth membutuhkan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET; bila belum tersedia, tombol Google nonaktif dengan keterangan. Panduan lengkap: [docs/GOOGLE-LOGIN.md](docs/GOOGLE-LOGIN.md). Kredensial mahasiswa demo dari bagian README lama tidak lagi berlaku untuk login kata sandi.

## Riwayat & laporan terpadu (17 November 2026)

Menu pengelola Riwayat penggunaan dan Laporan digabung menjadi Riwayat & laporan (/app/laporan); /app/riwayat tetap diterima dan mengarahkan ke halaman gabungan. Akses USER ke laporan tetap ditolak, sedangkan kepala lab dapat membaca/mengekspor.

Ringkasan menghitung pengunjung unik, rata-rata kunjungan selesai, jam penggunaan PC aktual, dan sesi yang perlu ditinjau. Rata-rata serta jam hanya memakai sesi COMPLETED dengan check-out dan durasi valid; sesi ACTIVE, CORRECTED, dan catatan tidak lengkap tidak dianggap nol menit. Nilai nol yang valid tetap dihitung sebagai sesi selesai. Jam PC mengecualikan kunjungan tanpa PC. Sesi aktif dari hari sebelumnya (WIB), waktu akhir tidak diketahui setelah koreksi, dan sesi selesai dengan waktu tidak lengkap ditandai untuk diperiksa.

Kartu tinjauan membuka daftar sesi terkait tanpa menimpa data. Grafik memakai tanggal filter atau rentang data aktual, dengan maksimum 21 kelompok tanggal untuk rentang panjang. Tersedia rincian angka per periode, ringkasan penggunaan setiap komputer, riwayat presensi/peminjaman, dan ekspor CSV/PDF. Ekspor mengikuti pencarian, lab, PC, jenis pengguna, status peminjaman, serta tanggal. Pilihan tinjauan hanya menyaring tabel lokal; ekspor tetap mengikuti filter utama, sesuai keterangan di halaman.
