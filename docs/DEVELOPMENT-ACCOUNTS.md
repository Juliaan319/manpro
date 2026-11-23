# Akun pengembangan

Hanya dibuat oleh `npm run db:seed`. Seed menolak NODE_ENV=production. Jangan jalankan seed pada database produksi. Semua identitas, lokasi, spesifikasi PC, dan riwayat awal merupakan data demo.

| Peran | Email | Kata sandi |
|---|---|---|
| Mahasiswa | c140000001@john.petra.ac.id | LabTrackDemo2026! |
| Administrator laboratorium | admin@labtrack.test | LabTrackDemo2026! |
| Kepala laboratorium | kepala@labtrack.test | LabTrackDemo2026! |

Akun ini bukan akun universitas asli. Tidak ada kredensial SSO Petra. Registrasi publik selalu membuat USER; hanya administrator dapat membuat akun LAB_ADMIN/HEAD_LAB melalui menu Pengguna. Untuk produksi kosong, buat administrator pertama melalui proses provisioning database yang dikendalikan operator, dengan hash bcrypt, lalu buat akun tambahan melalui UI administrator. Jangan memindahkan pengguna demo ke produksi.
