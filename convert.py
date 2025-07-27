from ultralytics import YOLO

def convert_pt_to_onnx():
    # Path ke model .pt kamu
    model_path = "C:/Users/JuhenFW/VSCODE/ObjectCount/models/pen_best3.pt"
    
    # Load model
    print("Loading model...")
    model = YOLO(model_path)
    
    # Export to ONNX
    print("Converting to ONNX...")
    onnx_path = model.export(
        format='onnx',
        imgsz=640,
        simplify=True,
        opset=12
    )
    
    print(f"✅ Model converted successfully!")
    print(f"📁 ONNX model saved to: {onnx_path}")
    
    return onnx_path

if __name__ == '__main__':
    convert_pt_to_onnx()
