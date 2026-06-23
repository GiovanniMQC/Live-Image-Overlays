import os
import sys
import time
import numpy as np
import soundfile
from flask import Flask, request, jsonify

# Adiciona a pasta RVC_Onnx_Infer ao path para importar os módulos
rvc_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'RVC_Onnx_Infer')
sys.path.append(rvc_dir)

from infer.lib.infer_pack.onnx_inference import OnnxRVC

app = Flask(__name__)

# Configurações do ONNX (sampling_rate é detectado automaticamente por modelo)
HOP_SIZE = 128
DEVICE = "cpu"
VEC_NAME = "vec-768-layer-12"

# Cache do modelo carregado (evita recarregar a cada requisição)
modelo_atual_path = None
modelo_onnx = None
modelo_sr = None  # Sample rate real do modelo, detectado na carga


def detectar_sr_do_modelo(model_path):
    """
    Lê o sample rate diretamente da saída 'sr' do modelo ONNX.
    Modelos RVC exportados modernamente incluem sr como segunda saída.
    Retorna 40000 como fallback se não for possível detectar.
    """
    import onnxruntime as ort

    try:
        session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
        outputs = session.get_outputs()

        # Verifica se há uma saída 'sr'
        if len(outputs) < 2:
            print("⚠️  Modelo sem saída 'sr'. Usando fallback 40000 Hz.")
            return 40000

        # Roda uma inferência dummy para extrair o valor de sr
        phone_len = 10
        inputs_dict = {
            session.get_inputs()[0].name: np.zeros((1, phone_len, 768), dtype=np.float32),
            session.get_inputs()[1].name: np.array([phone_len], dtype=np.int64),
            session.get_inputs()[2].name: np.zeros((1, phone_len), dtype=np.int64),
            session.get_inputs()[3].name: np.zeros((1, phone_len), dtype=np.float32),
            session.get_inputs()[4].name: np.array([0], dtype=np.int64),
        }
        results = session.run(None, inputs_dict)
        detected_sr = int(results[1][0])
        print(f"✅ Sample rate detectado do modelo: {detected_sr} Hz")
        return detected_sr

    except Exception as e:
        print(f"⚠️  Não foi possível detectar SR do modelo ({e}). Usando fallback 40000 Hz.")
        return 40000


def carregar_modelo(model_path):
    """Carrega o modelo ONNX e mantém em cache."""
    global modelo_atual_path, modelo_onnx, modelo_sr

    if model_path == modelo_atual_path and modelo_onnx is not None:
        return  # Modelo já em cache

    # Detecta o sample rate antes de instanciar o OnnxRVC
    sr = detectar_sr_do_modelo(model_path)

    # O OnnxRVC busca assets de forma relativa. Precisamos rodar de dentro
    # da pasta RVC_Onnx_Infer (mesmo padrão que o testar_onnx.py).
    cwd_original = os.getcwd()
    os.chdir(rvc_dir)
    try:
        print(f"Carregando modelo ONNX: {model_path} | SR={sr} Hz | hop_size={HOP_SIZE}...")
        modelo_onnx = OnnxRVC(
            model_path,
            vec_path=VEC_NAME,
            sr=sr,
            hop_size=HOP_SIZE,
            device=DEVICE
        )
        modelo_atual_path = model_path
        modelo_sr = sr
        print(f"✅ Modelo ONNX carregado: {model_path}")
    finally:
        os.chdir(cwd_original)


@app.route('/converter', methods=['POST'])
def converter_audio():
    dados = request.json
    input_path = dados.get('input_path')
    output_path = dados.get('output_path')
    model_path = dados.get('model_path')
    pitch = dados.get('pitch', 0)
    method = dados.get('method', 'pm')

    if not all([input_path, output_path, model_path]):
        return jsonify({"erro": "Faltam parâmetros (input_path, output_path, model_path)"}), 400

    # Garante que o método seja válido para o ONNX (pm, harvest, dio)
    metodos_validos = ('pm', 'harvest', 'dio')
    if method not in metodos_validos:
        print(f"⚠️  Método '{method}' não suportado pelo ONNX. Usando 'pm'.")
        method = 'pm'

    try:
        carregar_modelo(model_path)
    except Exception as e:
        return jsonify({"erro": f"Falha ao carregar modelo ONNX: {e}"}), 500

    print(f"▶ Inferindo ONNX | SR={modelo_sr} Hz | método: {method} | pitch: {pitch:+d} | saída: {output_path}")
    start_time = time.time()

    # A inferência precisa ser executada com o cwd dentro de RVC_Onnx_Infer
    cwd_original = os.getcwd()
    os.chdir(rvc_dir)
    try:
        audio = modelo_onnx.inference(input_path, sid=0, f0_method=method, f0_up_key=pitch)
    except Exception as e:
        return jsonify({"erro": f"Falha na inferência ONNX: {e}"}), 500
    finally:
        os.chdir(cwd_original)

    elapsed = round(time.time() - start_time, 2)
    print(f"✅ ONNX concluído em {elapsed}s")

    # Usa o SR real do modelo para salvar corretamente
    try:
        soundfile.write(output_path, audio, modelo_sr)
    except Exception as e:
        return jsonify({"erro": f"Falha ao salvar áudio: {e}"}), 500

    return jsonify({"status": "sucesso", "tempo_segundos": elapsed}), 200


if __name__ == '__main__':
    print("Iniciando motor do RVC-ONNX...")
    app.run(port=5051)
