import base64
import json
import os

from django.conf import settings
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework import status


class TermsContentAPIView(APIView):
    """Devuelve el contenido de términos (codificado en Base64) para un código dado.

    Soporta GET con queryparam `code` o POST con JSON `{ "code": 100 }`.
    El contenido se lee desde `terms/contents.json`.
    """

    def get_contents_map(self):
        base = settings.BASE_DIR if hasattr(settings, 'BASE_DIR') else os.path.dirname(os.path.dirname(__file__))
        path = os.path.join(base, 'terms', 'contents.json')
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def get(self, request, *args, **kwargs):
        code = request.query_params.get('code')
        if not code:
            return JsonResponse({'detail': 'code query param required'}, status=status.HTTP_400_BAD_REQUEST)

        contents = self.get_contents_map()
        content_obj = contents.get(str(code))
        if not content_obj:
            return JsonResponse({'detail': 'Content not found for code'}, status=status.HTTP_404_NOT_FOUND)

        # Build an enhanced HTML document with better styling
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
            <title>{title}</title>
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 18px !important;  /* Tamaño de fuente aumentado */
                    line-height: 1.7;
                    color: #2c3e50;
                    padding: 25px 20px;
                    margin: 0;
                    background-color: #ffffff;
                    -webkit-text-size-adjust: 100%;
                    text-size-adjust: 100%;
                }}
                
                .document-container {{
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                
                .document-header {{
                    text-align: center;
                    margin-bottom: 35px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e8f4fc;
                }}
                
                .document-title {{
                    font-size: 28px !important;
                    font-weight: 700;
                    color: #1976d2;
                    margin-bottom: 12px;
                    line-height: 1.3;
                }}
                
                .document-code {{
                    display: inline-block;
                    background-color: #e3f2fd;
                    color: #1565c0;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 16px;
                    font-weight: 600;
                    margin-top: 10px;
                }}
                
                .content-section {{
                    margin-bottom: 35px;
                }}
                
                h1 {{
                    font-size: 26px !important;
                    font-weight: 700;
                    color: #1a237e;
                    margin: 30px 0 15px 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #e0e0e0;
                }}
                
                h2 {{
                    font-size: 22px !important;
                    font-weight: 600;
                    color: #0d47a1;
                    margin: 25px 0 12px 0;
                }}
                
                h3 {{
                    font-size: 20px !important;
                    font-weight: 600;
                    color: #1976d2;
                    margin: 20px 0 10px 0;
                }}
                
                p {{
                    font-size: 18px !important;
                    line-height: 1.7;
                    margin-bottom: 18px;
                    text-align: justify;
                    color: #37474f;
                }}
                
                ul, ol {{
                    margin-left: 28px;
                    margin-bottom: 22px;
                }}
                
                li {{
                    font-size: 18px !important;
                    line-height: 1.7;
                    margin-bottom: 12px;
                    color: #455a64;
                }}
                
                strong, b {{
                    font-weight: 700;
                    color: #1565c0;
                }}
                
                em, i {{
                    font-style: italic;
                    color: #546e7a;
                }}
                
                mark {{
                    background-color: #fff9c4 !important;
                    color: #000 !important;
                    padding: 2px 4px;
                    border-radius: 3px;
                }}
                
                .highlight {{
                    background-color: #e8f5e9;
                    padding: 15px;
                    border-radius: 10px;
                    border-left: 4px solid #4caf50;
                    margin: 15px 0;
                }}
                
                .note {{
                    background-color: #fff3e0;
                    padding: 15px;
                    border-radius: 10px;
                    border-left: 4px solid #ff9800;
                    margin: 15px 0;
                }}
                
                .important {{
                    background-color: #ffebee;
                    padding: 15px;
                    border-radius: 10px;
                    border-left: 4px solid #f44336;
                    margin: 15px 0;
                }}
                
                .last-updated {{
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px dashed #b0bec5;
                    color: #78909c;
                    font-size: 16px;
                }}
                
                @media (max-width: 768px) {{
                    body {{
                        font-size: 19px !important;  /* Más grande en móviles */
                        padding: 20px 15px;
                    }}
                    
                    .document-container {{
                        padding: 15px;
                    }}
                    
                    .document-title {{
                        font-size: 26px !important;
                    }}
                    
                    h1 {{
                        font-size: 24px !important;
                    }}
                    
                    h2 {{
                        font-size: 21px !important;
                    }}
                    
                    h3 {{
                        font-size: 19px !important;
                    }}
                    
                    p, li {{
                        font-size: 19px !important;
                    }}
                }}
                
                @media (max-width: 480px) {{
                    body {{
                        font-size: 20px !important;  /* Aún más grande en pantallas pequeñas */
                        padding: 18px 12px;
                    }}
                    
                    .document-title {{
                        font-size: 24px !important;
                    }}
                    
                    h1 {{
                        font-size: 22px !important;
                    }}
                    
                    h2 {{
                        font-size: 20px !important;
                    }}
                    
                    h3 {{
                        font-size: 18px !important;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="document-container">
                <div class="document-header">
                    <h1 class="document-title">{title}</h1>
                    <div class="document-code">Documento - Código {code}</div>
                </div>
                <div class="content-section">
        """.format(title=content_obj.get('title'), code=code)

        # Procesar el contenido del body
        body_content = content_obj.get('body', '')
        
        # Dividir por líneas y procesar
        lines = body_content.split('\n')
        current_paragraph = []
        
        for line in lines:
            line = line.strip()
            if line:  # Si la línea tiene contenido
                current_paragraph.append(line)
            elif current_paragraph:  # Si encontramos línea vacía y tenemos párrafo acumulado
                # Unir el párrafo con espacios
                paragraph_text = ' '.join(current_paragraph)
                
                # Detectar si es un título o lista numerada
                if paragraph_text.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.')):
                    # Es un ítem de lista numerada
                    html += f"<p><strong>{paragraph_text}</strong></p>"
                elif len(paragraph_text) < 100 and ':' in paragraph_text:
                    # Posiblemente un subtítulo
                    html += f"<h3>{paragraph_text}</h3>"
                else:
                    # Párrafo normal
                    html += f"<p>{paragraph_text}</p>"
                
                current_paragraph = []
        
        # Procesar el último párrafo si existe
        if current_paragraph:
            paragraph_text = ' '.join(current_paragraph)
            if paragraph_text.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.')):
                html += f"<p><strong>{paragraph_text}</strong></p>"
            elif len(paragraph_text) < 100 and ':' in paragraph_text:
                html += f"<h3>{paragraph_text}</h3>"
            else:
                html += f"<p>{paragraph_text}</p>"

        # Cerrar el HTML
        html += """
                </div>
                <div class="last-updated">
                    Documento oficial de ParkeaYa<br>
                    Última actualización: 2025
                </div>
            </div>
        </body>
        </html>
        """

        encoded = base64.b64encode(html.encode('utf-8')).decode('ascii')
        return JsonResponse({'content_base64': encoded})

    def post(self, request, *args, **kwargs):
        code = request.data.get('code')
        if code is None:
            return JsonResponse({'detail': 'code field required'}, status=status.HTTP_400_BAD_REQUEST)

        contents = self.get_contents_map()
        content_obj = contents.get(str(code))
        if not content_obj:
            return JsonResponse({'detail': 'Content not found for code'}, status=status.HTTP_404_NOT_FOUND)

        # Usar la misma función que get() para consistencia
        # Build an enhanced HTML document with better styling
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
            <title>{title}</title>
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 18px !important;
                    line-height: 1.7;
                    color: #2c3e50;
                    padding: 25px 20px;
                    margin: 0;
                    background-color: #ffffff;
                    -webkit-text-size-adjust: 100%;
                    text-size-adjust: 100%;
                }}
                
                .document-container {{
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                
                .document-header {{
                    text-align: center;
                    margin-bottom: 35px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e8f4fc;
                }}
                
                .document-title {{
                    font-size: 28px !important;
                    font-weight: 700;
                    color: #1976d2;
                    margin-bottom: 12px;
                    line-height: 1.3;
                }}
                
                .document-code {{
                    display: inline-block;
                    background-color: #e3f2fd;
                    color: #1565c0;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 16px;
                    font-weight: 600;
                    margin-top: 10px;
                }}
                
                .content-section {{
                    margin-bottom: 35px;
                }}
                
                p {{
                    font-size: 18px !important;
                    line-height: 1.7;
                    margin-bottom: 18px;
                    text-align: justify;
                    color: #37474f;
                }}
                
                strong {{
                    font-weight: 700;
                    color: #1565c0;
                }}
                
                .last-updated {{
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px dashed #b0bec5;
                    color: #78909c;
                    font-size: 16px;
                }}
                
                @media (max-width: 768px) {{
                    body {{
                        font-size: 19px !important;
                        padding: 20px 15px;
                    }}
                    
                    .document-container {{
                        padding: 15px;
                    }}
                    
                    .document-title {{
                        font-size: 26px !important;
                    }}
                    
                    p {{
                        font-size: 19px !important;
                    }}
                }}
                
                @media (max-width: 480px) {{
                    body {{
                        font-size: 20px !important;
                        padding: 18px 12px;
                    }}
                    
                    .document-title {{
                        font-size: 24px !important;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="document-container">
                <div class="document-header">
                    <h1 class="document-title">{title}</h1>
                    <div class="document-code">Documento - Código {code}</div>
                </div>
                <div class="content-section">
        """.format(title=content_obj.get('title'), code=code)

        # Procesar el contenido del body
        body_content = content_obj.get('body', '')
        lines = body_content.split('\n')
        current_paragraph = []
        
        for line in lines:
            line = line.strip()
            if line:
                current_paragraph.append(line)
            elif current_paragraph:
                paragraph_text = ' '.join(current_paragraph)
                if paragraph_text.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.')):
                    html += f"<p><strong>{paragraph_text}</strong></p>"
                else:
                    html += f"<p>{paragraph_text}</p>"
                current_paragraph = []
        
        if current_paragraph:
            paragraph_text = ' '.join(current_paragraph)
            if paragraph_text.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.')):
                html += f"<p><strong>{paragraph_text}</strong></p>"
            else:
                html += f"<p>{paragraph_text}</p>"

        html += """
                </div>
                <div class="last-updated">
                    Documento oficial de ParkeaYa<br>
                    Última actualización: 2025
                </div>
            </div>
        </body>
        </html>
        """

        encoded = base64.b64encode(html.encode('utf-8')).decode('ascii')
        return JsonResponse({'content_base64': encoded})