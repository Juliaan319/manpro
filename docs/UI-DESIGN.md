# Arah tampilan portal LabTrack

Referensi: tangkapan layar dashboard Architect yang diberikan pengguna pada 16 November 2026. Implementasi memakai susunan sidebar putih, header tipis, latar abu-abu muda, ringkasan statistik tiga kolom, tabel operasional, dan catatan aktivitas. Tidak menyalin data, logo, atau menu contoh dari referensi.

Warna utama biru #315fbb; teks #303845; latar #f1f4f7; garis #e0e5ec. Panel bersudut 4px, bayangan ringan, huruf Segoe UI/Arial, judul halaman 23px, isi portal 12–13px. Tombol pada perangkat sentuh minimal 44px. Focus keyboard dan reduced-motion dipertahankan.

Navigasi dikelompokkan menjadi Utama, Layanan, Perangkat, Riwayat & Laporan, dan Akun. Kelompok yang tidak dapat diakses peran tidak ditampilkan. Dasbor pengelola menampilkan ketersediaan perangkat, pengajuan peminjaman, kehadiran aktif, dan catatan audit aktual. Angka tidak menggunakan data grafik rekaan. Dasbor mahasiswa hanya memuat ringkasan dan tabel miliknya.

Halaman depan mempertahankan foto laboratorium Petra, dengan judul dan keterangan layanan yang langsung. Palet halaman depan, login, remote PC, inventaris, profil, dan pemindai presensi mengikuti portal. Aturan tampilan baru ditempatkan di src/app/portal.css; alur otorisasi dan backend tidak diubah.
