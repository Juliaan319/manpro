# Mengaktifkan login Google mahasiswa LabTrack

Kode sudah disiapkan. Login Google asli memerlukan OAuth Client ID dan Client Secret milik project Google Cloud Anda. Selama kedua nilai belum diisi, tombol Google sengaja dinonaktifkan. Login kata sandi mahasiswa (termasuk akun demo lama) sudah ditutup; admin dan kepala lab tetap memakai bagian **Masuk pengelola**.

## 1. Buat project dan consent screen

1. Buka https://console.cloud.google.com/ dan buat/pilih project **LabTrack**.
2. Buka **Google Auth Platform**. Jika diminta, klik **Get started**. Pada tampilan lama, pengaturannya berada di **APIs & Services → OAuth consent screen**.
3. Isi nama aplikasi, misalnya **LabTrack Petra**, email dukungan, dan email kontak pengembang.
4. Pilih audience yang tersedia. Jika project berada di organisasi Google Workspace Petra dan opsi **Internal** tersedia, dapat menggunakan Internal. Jika tidak, gunakan **External**; selama status Testing, masukkan email kampus yang akan mencoba ke daftar **Test users**.
5. Cukup gunakan data identitas dasar: OpenID, email, dan profil. Aplikasi tidak meminta akses Gmail, Drive, atau Calendar.

## 2. Buat OAuth Client

1. Buka **Clients → Create client** (atau **Credentials → Create credentials → OAuth client ID**).
2. Pilih **Web application**.
3. Untuk pengembangan lokal, isi:

| Pengaturan | Nilai |
| --- | --- |
| Authorized JavaScript origins | `http://localhost:3000` |
| Authorized redirect URIs | `http://localhost:3000/api/auth/callback/google` |

4. Simpan, kemudian salin **Client ID** dan **Client Secret** ke file `.env` di root proyek. Jangan commit file tersebut.

```dotenv
GOOGLE_CLIENT_ID="CLIENT_ID_ANDA.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="CLIENT_SECRET_ANDA"
NEXTAUTH_URL="http://localhost:3000"
```

Dua baris Google kosong sudah disiapkan pada `.env`. Isi nilainya langsung pada file lokal; tidak perlu mengganti DATABASE_URL, QR_SECRET, atau NEXTAUTH_SECRET.

## 3. Jalankan ulang aplikasi

Setelah mengisi `.env`, hentikan proses server yang sedang berjalan dengan Ctrl+C pada terminalnya, kemudian dari `C:\MANPRO` jalankan:

```powershell
npm run build
npm start
```

Jika database lokal belum menyala, jalankan dahulu:

```powershell
.\scripts\start-local-db.ps1
```

Buka http://localhost:3000/login dan klik **Masuk dengan Google**. Uji di browser biasa apabila Google tidak mengizinkan autentikasi pada browser tertanam.

## Perilaku akun

- Email wajib berformat `c14` + satu atau lebih angka + `@john.petra.ac.id`, serta email harus terverifikasi oleh Google. Email jurusan lain, Gmail pribadi, subdomain tambahan, dan akhiran domain lain ditolak oleh server.
- Login pertama membuat akun USER/STUDENT dengan nama dari profil Google, NRP dari bagian email sebelum @, dan institusi Universitas Kristen Petra.
- Jika email sudah ada, ID akun dan riwayatnya tetap dipakai. Nama diperbarui dari Google setiap login; mahasiswa tidak dapat mengganti nama tersebut lewat form profil lokal.
- Google subject disimpan sebagai pengikat identitas unik. Subject lain tidak dapat menimpa akun yang sudah terhubung.
- Role pengelola yang sudah diberikan tidak berubah ketika akun kampus tersebut masuk dengan Google. Google tidak otomatis menjadikan akun sebagai admin/kepala lab.
- Sesi mahasiswa lama yang dibuat melalui kata sandi tidak lagi dapat mengakses portal. Mahasiswa masuk ulang melalui Google setelah konfigurasi aktif.
- Nama pada header, profil, dan data aktivitas memakai nama akun yang tersimpan setelah sinkronisasi Google.

## Saat memakai domain publik

Isi NEXTAUTH_URL dengan URL HTTPS aplikasi, lalu daftarkan origin dan callback domain tersebut di OAuth client yang sesuai. Callback harus persis `https://DOMAIN_APLIKASI/api/auth/callback/google`. QR laboratorium harus memakai origin aplikasi yang sama. Perubahan origin harus diikuti pembaruan/cetak ulang QR yang masih memuat alamat localhost. Untuk lingkungan produksi, gunakan project/client Google sesuai kebijakan kampus dan konfigurasi produksi terpisah dari lokal.

## Jika ditolak Google

- **redirect_uri_mismatch:** cocokan skema, host, port, dan path callback; tidak menambahkan trailing slash.
- **access_denied / app Testing:** periksa audience dan Test users project Google.
- Akun kampus diblokir kebijakan organisasi: pengelola Google Workspace Petra perlu mengizinkan aplikasi.
- **Akses ditolak** setelah kembali ke LabTrack: periksa pola email, verifikasi Google, dan apakah identitas sudah terhubung ke akun lain.

## Bukti pengujian dan batasnya

Tes lokal memeriksa validasi profil Google, nama, pemetaan ID lokal ke JWT/session, penggunaan ulang akun, pembatasan peran, subject unik, login bersamaan, penolakan kata sandi mahasiswa, dan penolakan sesi lama. Alur browser mahasiswa menggunakan cookie sesi bertanda tangan khusus pengujian agar fitur portal dapat diuji tanpa akun Google sungguhan. Tidak ada endpoint bypass login pada aplikasi. Login Google langsung dari pemilihan akun sampai callback belum dapat diuji sebelum kredensial OAuth asli diisi.

Referensi resmi:
- https://next-auth.js.org/providers/google
- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/protocols/oauth2/web-server

## Jika Google mengarahkan ke SSO Petra

LabTrack memakai OAuth/OpenID Connect Google, bukan integrasi login SAML Petra. Permintaan login menampilkan pemilih akun (`prompt=select_account`) dan tidak mengirim parameter `hd` atau `login_hint`. Pembatasan email tetap diterapkan server pada profil Google yang terverifikasi.

Akun Google Workspace kampus dapat menggunakan identity provider Petra. Jika Google mengalihkan akun terpilih ke sso.petra.ac.id, itu merupakan autentikasi akun Google yang dikelola kampus. Menghapus petunjuk domain tidak menonaktifkan kebijakan organisasi dan tidak menjamin akun kampus dapat memakai formulir kata sandi Google biasa. Pengubahan kebijakan tersebut memerlukan administrator Google Workspace Petra. Jika sesi Google kampus sudah aktif, Google mungkin dapat menggunakan sesi itu, sesuai kebijakan autentikasinya.

Referensi: https://knowledge.workspace.google.com/admin/apps/optional-sso-settings-and-maintenance dan https://developers.google.com/identity/openid-connect/openid-connect .
