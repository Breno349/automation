import json
import base64

with open('example.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# separators sem espaço garante texto corrido, sem quebras/tabs
texto_corrido = json.dumps(data, separators=(',', ':'), ensure_ascii=False)

data_base64 = base64.b64encode(texto_corrido.encode('utf-8')).decode('utf-8')

print(data_base64)
