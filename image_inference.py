"""Deep Guard V3: ViT V3 + especialista + pHash de imagens reais conhecidas."""
import io
import warnings
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "models" / "imagem_v3"
MAX_BYTES = 10 * 1024 * 1024
_runtime = None


def _probabilities(scores, classes):
    values = {int(label): float(scores[i]) for i, label in enumerate(classes)}
    if set(values) != {0, 1}:
        raise RuntimeError("O classificador especialista não tem as classes 0 e 1.")
    return values[0], values[1]


def load_runtime():
    global _runtime
    if _runtime is not None:
        return _runtime
    required = ["config.json", "model_v3_state_dict.pth", "menu_classifier.pkl", "config.pkl", "known_real_images.pkl"]
    missing = [name for name in required if not (MODEL_DIR / name).is_file()]
    if missing:
        raise RuntimeError("Arquivos da V3 ausentes em models/imagem_v3: " + ", ".join(missing))
    import joblib
    import torch
    from torchvision import transforms
    from transformers import ViTConfig, ViTForImageClassification
    config = ViTConfig.from_json_file(str(MODEL_DIR / "config.json"))
    labels = {str(k): str(v) for k, v in config.id2label.items()}
    if labels != {"0": "REAL", "1": "FAKE"}:
        raise RuntimeError("config.json incompatível: a V3 exige 0=REAL e 1=FAKE.")
    model = ViTForImageClassification(config)
    try:
        state = torch.load(MODEL_DIR / "model_v3_state_dict.pth", map_location="cpu", weights_only=True)
    except TypeError:
        state = torch.load(MODEL_DIR / "model_v3_state_dict.pth", map_location="cpu")
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    if not isinstance(state, dict):
        raise RuntimeError("model_v3_state_dict.pth não contém um state_dict válido.")
    if any(str(k).startswith("module.") for k in state):
        state = {str(k)[7:]: v for k, v in state.items()}
    try:
        model.load_state_dict(state, strict=True)
    except RuntimeError as error:
        raise RuntimeError("Pesos incompatíveis com a arquitetura da V3.") from error
    specialist = joblib.load(MODEL_DIR / "menu_classifier.pkl")
    saved_config = joblib.load(MODEL_DIR / "config.pkl")
    known_real = joblib.load(MODEL_DIR / "known_real_images.pkl")
    if int(saved_config.get("embedding_dim", 0)) != int(config.hidden_size):
        raise RuntimeError("Dimensão do especialista não corresponde ao ViT da V3.")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device).eval()
    transform = transforms.Compose([
        transforms.Resize((224, 224)), transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    _runtime = torch, model, transform, specialist, saved_config, known_real, device
    return _runtime


def _known_real(image, known_real, threshold):
    import imagehash
    query = imagehash.phash(image)
    best_name, best_distance = None, float("inf")
    for name, known_hash in known_real.items():
        distance = query - known_hash
        if distance < best_distance:
            best_name, best_distance = name, distance
    return best_distance <= threshold, best_name, best_distance


def analyze_image(payload):
    from PIL import Image, UnidentifiedImageError
    if not payload or len(payload) > MAX_BYTES:
        raise ValueError("Envie JPG, PNG ou WEBP com até 10 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as original:
                width, height = original.size
                if original.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Formato não suportado. Use JPG, PNG ou WEBP.")
                if width * height > 25_000_000 or getattr(original, "n_frames", 1) != 1:
                    raise ValueError("Use uma imagem estática com até 25 milhões de pixels.")
                image = original.convert("RGB")
    except (OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError("Imagem inválida, corrompida ou grande demais.") from error
    torch, model, transform, specialist, saved_config, known_real, device = load_runtime()
    threshold = int(saved_config.get("known_real_threshold", 8))
    known, match, distance = _known_real(image, known_real, threshold)
    if known:
        return {
            "resultado": "REAL", "pontuacao_ia": 0.0, "pontuacao_real": 1.0,
            "largura": width, "altura": height, "modelo": "Deep Guard V3",
            "versao_analise": "imagem-v3", "tipo": "Imagem real conhecida",
            "arquivo_correspondente": str(match), "distancia_phash": int(distance),
            "aviso": "A imagem corresponde ao banco de imagens reais conhecidas. Pontuações não comprovam origem ou veracidade.",
        }
    tensor = transform(image).unsqueeze(0).to(device)
    with torch.inference_mode():
        vit_output = model.vit(pixel_values=tensor, return_dict=True)
        embedding = vit_output.last_hidden_state[:, 0, :].cpu().numpy()
        specialist_scores = specialist.predict_proba(embedding)[0]
        specialist_real, specialist_fake = _probabilities(specialist_scores, specialist.classes_)
        model_scores = torch.softmax(model(pixel_values=tensor).logits, dim=1)[0]
        if model_scores.numel() != 2 or not bool(torch.isfinite(model_scores).all()):
            raise RuntimeError("Saída inválida do modelo V3.")
        v3_real, v3_fake = float(model_scores[0]), float(model_scores[1])
    specialist_weight = float(saved_config.get("specialist_weight", 0.65))
    v3_weight = float(saved_config.get("v3_weight", 0.35))
    final_real = specialist_weight * specialist_real + v3_weight * v3_real
    final_fake = specialist_weight * specialist_fake + v3_weight * v3_fake
    return {
        "resultado": "IA" if final_fake >= final_real else "REAL",
        "pontuacao_ia": final_fake, "pontuacao_real": final_real,
        "especialista_ia": specialist_fake, "especialista_real": specialist_real,
        "v3_ia": v3_fake, "v3_real": v3_real, "largura": width, "altura": height,
        "modelo": "Deep Guard V3", "versao_analise": "imagem-v3",
        "tipo": "Detectado pelo Deep Guard V3",
        "distancia_phash": int(distance) if distance != float("inf") else None,
        "aviso": "A V3 combina o ViT com o especialista e o pHash. Pontuações do modelo não comprovam origem ou veracidade; imagens fora do domínio de treinamento podem ser classificadas incorretamente.",
    }
