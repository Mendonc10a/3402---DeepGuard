"""Serviço local de inferência. Execute com Python 3.11, 3.12 ou 3.13."""
import json
import os
import re
import unicodedata
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
import joblib

bundle = joblib.load(Path(__file__).parent / "models/detector_experimental.joblib")
model = bundle["modelo"]
limit = int(bundle["limite_caracteres"])
assert set(model.classes_) == {0, 1}

def split_text(text, maximum=400):
    """Trechos contíguos, sem sobreposição e sem descartar o final."""
    if maximum < 100:
        raise ValueError("Limite do modelo incompatível.")
    count = (len(text) + maximum - 1) // maximum
    width, remainder = divmod(len(text), count)
    chunks = []
    start = 0
    for i in range(count):
        end = start + width + (1 if i < remainder else 0)
        chunks.append((start, end, text[start:end]))
        start = end
    return chunks


def analyze(text):
    if not isinstance(text, str) or len(text) > 20000:
        raise ValueError("Envie um texto com até 20.000 caracteres.")
    normalized = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()
    if len(normalized) < 100:
        raise ValueError("Informe pelo menos 100 caracteres após normalizar os espaços.")
    chunks = split_text(normalized, limit)
    probabilities = model.predict_proba([part for _, _, part in chunks])
    ia_index = list(model.classes_).index(1)
    human_index = list(model.classes_).index(0)
    details = []
    for i, ((start, end, part), scores) in enumerate(zip(chunks, probabilities), 1):
        ia = float(scores[ia_index])
        human = float(scores[human_index])
        details.append(dict(numero=i, inicio=start, fim=end, texto=part,
                            caracteres=len(part), pontuacao_ia=ia,
                            pontuacao_humano=human,
                            resultado="IA" if ia > human else "HUMANO"))
    # Média ponderada pelo tamanho; cada caractere participa de um único trecho.
    score_ia = sum(d["pontuacao_ia"] * d["caracteres"] for d in details) / len(normalized)
    score_human = sum(d["pontuacao_humano"] * d["caracteres"] for d in details) / len(normalized)
    return dict(resultado="IA" if score_ia > score_human else "HUMANO",
                pontuacao_ia=score_ia, pontuacao_humano=score_human,
                caracteres_analisados=len(normalized), limite_caracteres=limit,
                truncado=False, quantidade_trechos=len(details), trechos=details,
                agregacao="media_ponderada_por_caracteres", versao_analise="trechos-v1",
                modelo=bundle.get("escolhido", "Detector"),
                aviso="Resumo experimental pela média ponderada das pontuações dos trechos. "
                      "Não foi validado como detector de documentos completos. "
                      "A pontuação não é a porcentagem de texto escrito por IA, "
                      "não comprova autoria e não verifica a veracidade do conteúdo.")

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Não registrar o texto recebido.

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(200 if self.path == "/health" else 404,
                   {"ready": True} if self.path == "/health" else {"error": "Rota inexistente."})

    def do_POST(self):
        if self.path == "/analyze/image":
            try:
                from image_inference import analyze_image, MAX_BYTES
                size = int(self.headers.get("Content-Length", 0))
                if size <= 0 or size > MAX_BYTES:
                    return self.reply(413, {"error": "Envie uma imagem com até 10 MB."})
                self.connection.settimeout(30)
                result = analyze_image(self.rfile.read(size))
            except ValueError as error:
                return self.reply(400, {"error": str(error)})
            except RuntimeError as error:
                return self.reply(503, {"error": str(error)})
            except Exception:
                return self.reply(503, {"error": "Falha ao carregar a V3. Confira os arquivos do modelo e instale requirements-imagem.txt."})
            return self.reply(200, result)
        if self.path != "/analyze":
            return self.reply(404, {"error": "Rota inexistente."})
        try:
            size = int(self.headers.get("Content-Length", 0))
            if size <= 0 or size > 100000:
                return self.reply(413, {"error": "Tamanho de requisição inválido."})
            self.connection.settimeout(10)
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Envie um objeto JSON.")
            result = analyze(data.get("texto"))
        except (ValueError, UnicodeError):
            return self.reply(400, {"error": "Envie texto válido: mínimo 100 caracteres normalizados e máximo 20.000."})
        except Exception:
            return self.reply(500, {"error": "Falha ao executar o modelo."})
        self.reply(200, result)

if __name__ == "__main__":
    port = int(os.environ.get("MODEL_PORT", "8001"))
    print(f"Modelo carregado. Serviço local: http://127.0.0.1:{port}", flush=True)
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
