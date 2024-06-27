import json
import tiktoken
import requests
from flask_cors import CORS, cross_origin
from PIL import Image
from transformers import CLIPProcessor, CLIPModel, pipeline, AutoTokenizer
from flask import Flask, request, jsonify

app = Flask(__name__)
CORS(app)

encoding = tiktoken.get_encoding("cl100k_base")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
tokenizer = AutoTokenizer.from_pretrained("facebook/bart-large-cnn")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

@app.route("/")

@app.route('/clip-scores', methods=['POST'])
@cross_origin(origin='chrome-extension://caglaokjfpffmkcbjknpolcjgjomamea') 
def getClipScores():
   if request.method == 'POST':
        data = request.get_json()
        scores = data.get('scores')
        imageUrl = data.get('imageUrl')
        image = Image.open(requests.get(imageUrl, stream=True).raw)
        for entry in scores:
            entry["summary"] = summarize_text(entry["text"])
        texts = [entry['summary'] for entry in scores]
        inputs = processor(text=texts, images=image, return_tensors="pt", truncation=True, padding=True)
        outputs = model(**inputs)
        logits_per_image = outputs.logits_per_image
        probs = logits_per_image.softmax(dim=1).detach().cpu().numpy()
        for i, entry in enumerate(scores):
            entry['clip_score'] = float(probs[0, i])
        sorted_scores = sorted(scores, key=lambda x: x['clip_score'], reverse= True)
        print(jsonify("Sorted scores json", sorted_scores))
        return jsonify(sorted_scores) 

def summarize_text (text):
    tokens = tokenizer(text, return_tensors='pt', truncation=True, max_length=tokenizer.model_max_length, padding="max_length")
    input_ids = tokens.input_ids
    if input_ids.size(1) > tokenizer.model_max_length:
        summary = summarizer(text, max_length=77, min_length=20, do_sample=False)
        return summary[0]['summary_text']
    else:
        return text
    
if __name__ == "__main__":
    app.run(debug = True)