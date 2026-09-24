from PIL import Image
import os

# Cartella con le immagini originali
input_folder = r"path"
output_folder = r"path2"

# Assicurati che la cartella di output esista
os.makedirs(output_folder, exist_ok=True)

# Dimensioni desiderate (puoi cambiare in base al tipo)
width, height = 24, 24

# Scorri tutti i file nella cartella
for filename in os.listdir(input_folder):
    if filename.lower().endswith((".png", ".jpg", ".jpeg")):
        input_path = os.path.join(input_folder, filename)
        output_path = os.path.join(output_folder, filename)
        
        # Apri l'immagine
        with Image.open(input_path) as im:
            # Ridimensiona mantenendo proporzioni
            im_resized = im.resize((width, height), Image.Resampling.LANCZOS)
            # Salva l'immagine ridimensionata
            im_resized.save(output_path)
            print(f"Ridimensionata: {filename}")

print("Ridimensionamento completato!")
