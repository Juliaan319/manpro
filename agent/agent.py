"""Agen LabTrack: hanya metrik agregat; tanpa akses berkas pengguna."""
import argparse, os, random, subprocess, time, logging
from urllib.parse import urlparse
import psutil, requests
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
def metrics(simulate=False):
    if simulate:
        return dict(cpuPercent=random.uniform(8,80),ramPercent=random.uniform(20,70),gpuName='GPU SIMULASI',gpuPercent=random.uniform(0,95),gpuMemoryUsed=random.uniform(200,8000),gpuMemoryTotal=24576,gpuTemperature=random.uniform(35,75),gpuPower=random.uniform(30,300))
    data=dict(cpuPercent=psutil.cpu_percent(interval=1),ramPercent=psutil.virtual_memory().percent,gpuName=None,gpuPercent=None,gpuMemoryUsed=None,gpuMemoryTotal=None,gpuTemperature=None,gpuPower=None)
    try:
        result=subprocess.run(['nvidia-smi','--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=5,check=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        fields=[v.strip() for v in result.stdout.splitlines()[0].split(',')]
        data['gpuName']=fields[0]
        for key,value in zip(['gpuPercent','gpuMemoryUsed','gpuMemoryTotal','gpuTemperature','gpuPower'],fields[1:]):
            try: data[key]=float(value)
            except ValueError: data[key]=None
    except (OSError,subprocess.SubprocessError,IndexError): pass
    return data

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--simulate',action='store_true');parser.add_argument('--once',action='store_true');args=parser.parse_args()
    base=os.environ['LABTRACK_URL'].rstrip('/');url=urlparse(base)
    if url.scheme!='https' and not (os.getenv('ALLOW_LOCAL_HTTP')=='true' and url.hostname in ('localhost','127.0.0.1')): raise ValueError('HTTPS wajib; HTTP hanya untuk localhost yang diizinkan.')
    interval=max(15,int(os.getenv('INTERVAL_SECONDS','20')))
    logging.info('SIMULASI' if args.simulate else 'METRIK PERANGKAT FISIK')
    while True:
        try:
            response=requests.post(base+'/api/telemetry',json=dict(pcId=os.environ['PC_ID'],simulated=args.simulate,**metrics(args.simulate)),headers={'Authorization':'Bearer '+os.environ['DEVICE_SECRET']},timeout=10)
            response.raise_for_status()
            if response.json()['simulated']!=args.simulate: raise ValueError('Jenis kredensial tidak cocok. Rotasi kredensial melalui admin agar label sumber data benar.')
            logging.info('Heartbeat terkirim (%s)', 'SIMULASI' if args.simulate else 'PERANGKAT')
        except (requests.RequestException,ValueError) as exc: logging.error('Pengiriman gagal: %s',type(exc).__name__)
        if args.once: break
        time.sleep(interval)
if __name__=='__main__': main()
