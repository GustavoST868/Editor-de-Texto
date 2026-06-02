import os
import sys
import json
import requests
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/models", methods=["GET"])
def get_models():
    try:
        response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        if response.status_code == 200:
            data = response.json()
            models = [m["name"] for m in data.get("models", [])]
            return jsonify({"success": True, "models": models})
        return jsonify({"success": False, "error": f"Erro do Ollama: {response.status_code}"})
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False, 
            "error": "Não foi possível conectar ao Ollama. Verifique se o serviço está rodando na porta 11434."
        })

@app.route("/api/revise", methods=["POST"])
def revise_text():
    data = request.json or {}
    text = data.get("text", "")
    model = data.get("model", "")
    prompt_template = data.get("prompt", "")
    temperature = data.get("temperature", 0.7)

    if not text:
        return jsonify({"success": False, "error": "Nenhum texto fornecido."})
    if not model:
        return jsonify({"success": False, "error": "Nenhum modelo selecionado."})
    if not prompt_template:
        prompt_template = (
            "Revise o seguinte texto para melhorar a clareza e fluidez. "
            "Você deve manter o estilo de escrita. "
            "Retorne APENAS o texto revisado, sem comentários, explicações ou aspas extras.\n\n"
            "Texto:\n{text}"
        )

    prompt = prompt_template.replace("{text}", text)

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": float(temperature)
        }
    }

    try:
        response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=60)
        if response.status_code == 200:
            result = response.json()
            revised_text = result.get("response", "").strip()
            return jsonify({"success": True, "revised": revised_text})
        else:
            return jsonify({"success": False, "error": f"Erro na API do Ollama: Código {response.status_code}"})
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": f"Falha de comunicação com o Ollama: {str(e)}"})

if __name__ == "__main__":
    os.makedirs("templates", exist_ok=True)
    os.makedirs("static", exist_ok=True)
    
    port = int(os.environ.get("PORT", 5010))
    print(f"Iniciando o Escrita na porta {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
