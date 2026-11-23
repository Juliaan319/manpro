# Agen monitoring LabTrack

Agen harus dipasang secara sadar pada PC laboratorium. Agen mengirim metrik agregat CPU, RAM, dan GPU NVIDIA pertama jika tersedia. Tidak ada pengambilan berkas, tangkapan layar, riwayat browser, keystroke, akses desktop jarak jauh, atau eksekusi perintah dari server. Pemanggilan `nvidia-smi` bersifat tetap dan hanya untuk membaca metrik.

```powershell
cd C:\MANPRO
python -m venv agent\.venv
agent\.venv\Scripts\python -m pip install -r agent\requirements.txt
Copy-Item agent\.env.example agent\.env
```

Masuk sebagai administrator, buka Data PC atau Monitoring PC, tekan **Agen**, pilih jenis sumber, dan buat kredensial. Salin ID dan rahasia ke `agent/.env`. Backend menyimpan hash rahasia; rahasia hanya muncul sekali dan tidak tersedia pada dashboard pembaca. Rotasi membatalkan rahasia lama.

```powershell
# Perangkat sungguhan: gunakan kredensial jenis Perangkat fisik.
agent\.venv\Scripts\python agent\agent.py
# Pengembangan: gunakan kredensial jenis SIMULASI.
agent\.venv\Scripts\python agent\agent.py --simulate
# Satu heartbeat untuk pengujian.
agent\.venv\Scripts\python agent\agent.py --simulate --once
```

Gunakan HTTPS di produksi. HTTP hanya diterima oleh agen untuk localhost/127.0.0.1 jika `ALLOW_LOCAL_HTTP=true`. Default interval 20 detik, minimum 15 detik. Perangkat dianggap terputus setelah 60 detik tanpa heartbeat. Backend memberikan waktu penerimaan, bukan mempercayai jam klien. Semua metrik yang tidak didukung bernilai null dan ditampilkan sebagai tidak tersedia. Label SIMULASI ditentukan kredensial server dan harus cocok dengan mode agen. Jangan gunakan kredensial perangkat fisik untuk simulator.

Agent ini membaca GPU NVIDIA pertama. Lingkungan multi-GPU memerlukan perluasan protokol jika semua GPU ingin dipantau. Agen tidak mengubah status operasional PC. Hentikan dengan Ctrl+C. Jangan commit `.env` atau direktori virtual environment.
