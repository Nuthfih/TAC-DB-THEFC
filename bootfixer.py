import os

# Percorso della cartella con i tuoi HTML
cartella = r"path"

# Script da inserire
script = '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>\n'

# Ciclo su tutti i file nella cartella (e sottocartelle)
for root, dirs, files in os.walk(cartella):
    for file in files:
        if file.endswith(".html"):
            path_file = os.path.join(root, file)
            with open(path_file, "r", encoding="utf-8") as f:
                contenuto = f.read()
            
            # Inserisce lo script prima di </body>
            if script.strip() not in contenuto:
                contenuto_modificato = contenuto.replace("</body>", script + "</body>")
                with open(path_file, "w", encoding="utf-8") as f:
                    f.write(contenuto_modificato)
                print(f"Aggiunto script in: {path_file}")
