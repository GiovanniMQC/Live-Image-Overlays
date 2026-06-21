from flask import Flask, request, jsonify
from rvc_python.infer import RVCInference
import time

app = Flask(__name__)

print("Iniciando motor do RVC...")
rvc = RVCInference(device="cpu")
modelo_atual = None

@app.route('/converter', methods=['POST'])
def converter_audio():
    global modelo_atual

    dados = request.json
    input_path = dados.get('input_path')
    output_path = dados.get('output_path')
    model_path = dados.get('model_path')
    pitch = dados.get('pitch', 0)
    method = dados.get('method', 'rmvpe')

    if not all([input_path, output_path, model_path]):
        return jsonify({"erro": "Faltam parâmetros"}), 400

    if model_path != modelo_atual:
        print(f"Carregando novo modelo: {model_path}...")
        rvc.load_model(model_path)
        modelo_atual = model_path

    # Parâmetros são definidos como atributos da instância via set_params()
    # infer_file() só aceita input_path e output_path
    rvc.set_params(
        f0up_key=pitch,
        f0method=method,
        index_rate=0
    )

    start_time = time.time()

    try:
        rvc.infer_file(
            input_path=input_path,
            output_path=output_path
        )
        return jsonify({"status": "sucesso", "tempo_segundos": round(time.time() - start_time, 2)}), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5050)
