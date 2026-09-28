"""Empacotar apenas o código distribuível; recusar segredos reconhecíveis."""
from pathlib import Path
import re
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / 'NexSell-Vercel-GitHub.zip'
directories = {'app', 'components', 'lib', 'hooks', 'public', 'styles', 'supabase', 'tests', 'scripts', 'vendor'}
extensions = {'.ts', '.tsx', '.mjs', '.json', '.md', '.css', '.svg', '.png', '.jpg', '.woff2', '.sql', '.py'}
files = []
secret = re.compile(rb'(?:sb_secret_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
for p in sorted(root.rglob('*')):
    rel = p.relative_to(root)
    if not p.is_file() or p.is_symlink():
        continue
    if any(part in {'node_modules', '.next', '.git', '.sites-runtime', '__pycache__', 'review'} for part in rel.parts):
        continue
    if p.name.startswith('.env') and p.name != '.env.example':
        continue
    if len(rel.parts) > 1 and rel.parts[0] not in directories:
        continue
    if p.suffix not in extensions and p.name not in {'.env.example', '.gitignore'}:
        continue
    if p.name == 'next-env.d.ts':
        continue
    body = p.read_bytes()
    if secret.search(body):
        raise SystemExit('Empacotamento cancelado: possível segredo em ' + str(rel))
    files.append((p, rel.as_posix()))

with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for source, relative in files:
        archive.write(source, relative)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert {'package.json', 'supabase/schema.sql', '.env.example', 'GUIA_PUBLICACAO_E_CONEXOES.md'}.issubset(archive.namelist())
print(f'ZIP verificado: {len(files)} ficheiros; {target.stat().st_size} bytes; sem segredos reconhecidos pelo verificador.')
