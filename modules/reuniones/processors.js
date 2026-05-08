window.WashMeetingProcessors = (function(detector){
  const MAX_TEXT = 70000;
  function trim(text){return String(text||'').slice(0,MAX_TEXT).trim();}

  async function processAudio(file){
    return `[Audio cargado: ${file.name}]\nEl audio se enviará al gateway IA para transcripción interna y resumen operacional. No se mostrará la transcripción completa.`;
  }
  async function processPDF(file){
    if(!window.pdfjsLib)return `[PDF cargado: ${file.name}]\nExtracción de texto/OCR preparada para fase futura.`;
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    let text='';
    for(let i=1;i<=Math.min(pdf.numPages,40);i++){
      const page=await pdf.getPage(i);
      const content=await page.getTextContent();
      text+=content.items.map(item=>item.str).join(' ')+'\n';
      if(text.length>=MAX_TEXT)break;
    }
    return trim(text)||`[PDF cargado: ${file.name}]\nSin texto detectable. OCR preparado para Gemini OCR.`;
  }
  async function processDOCX(file){
    if(!window.mammoth)return `[DOCX cargado: ${file.name}]\nLectura estructurada preparada para fase futura.`;
    const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    return trim(result.value)||`[DOCX cargado: ${file.name}]\nNo se detectó texto.`;
  }
  async function processImageOCR(file){
    return `[Imagen cargada: ${file.name}]\nOCR pendiente. Preparado para Gemini OCR o motor OCR especializado.`;
  }
  async function processText(file){return trim(await file.text());}

  async function processFile(file){
    const type=detector.detectFileType(file);
    const meta=detector.metaForType(type);
    const processors={audio:processAudio,pdf:processPDF,docx:processDOCX,image:processImageOCR,text:processText};
    const text=processors[type]?await processors[type](file):`[Archivo cargado: ${file.name}]\nTipo no soportado todavía.`;
    return { name:file.name, type, icon:meta.icon, label:meta.label, status:'listo', note:meta.status, text };
  }

  return { processFile, processAudio, processPDF, processDOCX, processImageOCR, processText };
})(window.WashMeetingsFileDetector);
