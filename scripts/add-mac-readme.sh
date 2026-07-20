#!/bin/bash
# Add a Lisez-moi.txt to each macOS zip after build

TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'EOF'
Lisez-moi — CheminDeCroix
================================

macOS affiche parfois le message :
"CheminDeCroix est endommage, vous devriez placer cet element dans la corbeille"

L'application n'est pas reellement endommagee. C'est Gatekeeper qui bloque
les applications non signees.

Solution :
1. Extrayez le fichier .app de cette archive
2. Placez-le dans /Applications
3. Ouvrez le Terminal et lancez :

   xattr -cr /Applications/CheminDeCroix.app

4. Ouvrez l'application normalement
EOF

python3 - "$TMPFILE" << 'PYEOF'
import sys, zipfile, glob, os

readme_path = sys.argv[1]
with open(readme_path, 'r') as f:
    readme_content = f.read()

for zip_path in glob.glob('release/CheminDeCroix-*-mac.zip'):
    if os.path.isfile(zip_path):
        with zipfile.ZipFile(zip_path, 'a') as zf:
            if 'Lisez-moi.txt' not in zf.namelist():
                zf.writestr('Lisez-moi.txt', readme_content)
                print(f'Lisez-moi.txt ajoute a {os.path.basename(zip_path)}')
            else:
                print(f'Lisez-moi.txt deja present dans {os.path.basename(zip_path)}')
PYEOF

rm "$TMPFILE"
